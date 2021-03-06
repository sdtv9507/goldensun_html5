import {GameEvent, event_types} from "./GameEvent";
import * as _ from "lodash";
import {ControllableChar} from "../ControllableChar";
import * as numbers from "../magic_numbers";
import {directions} from "../utils";
import {NPC} from "../NPC";

export class MoveEvent extends GameEvent {
    private static readonly START_FOLLOW_TIME = 300;
    private static readonly MINIMAL_DISTANCE = 3;
    private is_npc: boolean;
    private dash: boolean;
    private dest_unit_in_tile: boolean;
    private camera_follow: boolean;
    private follow_hero_on_finish: boolean;
    private camera_follow_time: number;
    private minimal_distance: number;
    private dest: {x: number | string; y: number | string};
    private npc_index: number;
    private char: ControllableChar;
    private final_direction: number;
    private keep_npc_collision_disable: boolean;
    private deactive_char_on_end: boolean;
    private finish_events: GameEvent[] = [];

    constructor(
        game,
        data,
        active,
        is_npc,
        dash,
        dest_unit_in_tile,
        dest,
        npc_index,
        camera_follow,
        camera_follow_time,
        final_direction,
        follow_hero_on_finish,
        finish_events,
        minimal_distance,
        keep_npc_collision_disable,
        deactive_char_on_end
    ) {
        super(game, data, event_types.MOVE, active);
        this.is_npc = is_npc;
        this.dash = dash ?? false;
        this.dest = dest;
        this.npc_index = npc_index;
        this.dest_unit_in_tile = dest_unit_in_tile ?? true;
        this.camera_follow = camera_follow;
        this.camera_follow_time = camera_follow_time;
        this.minimal_distance = minimal_distance;
        this.keep_npc_collision_disable = keep_npc_collision_disable ?? false;
        this.deactive_char_on_end = deactive_char_on_end ?? false;
        this.follow_hero_on_finish = follow_hero_on_finish ?? true;
        this.final_direction = final_direction !== undefined ? directions[final_direction as string] : null;
        if (finish_events !== undefined) {
            finish_events.forEach(event_info => {
                const event = this.data.game_event_manager.get_event_instance(event_info);
                this.finish_events.push(event);
            });
        }
    }

    async _fire(origin_npc?: NPC) {
        if (!this.active) return;
        this.origin_npc = origin_npc;
        ++this.data.game_event_manager.events_running_count;
        this.data.collision.disable_npc_collision();
        if (this.is_npc) {
            this.char = this.data.map.npcs[this.npc_index];
        } else {
            this.char = this.data.hero;
        }
        this.char.dashing = this.dash;
        const dest_value = {
            x: typeof this.dest.x === "object" ? this.data.game_event_manager.get_value(this.dest.x) : this.dest.x,
            y: typeof this.dest.y === "object" ? this.data.game_event_manager.get_value(this.dest.y) : this.dest.y,
        };
        const dest = {
            x: this.dest_unit_in_tile ? (dest_value.x + 0.5) * this.data.map.tile_width : dest_value.x,
            y: this.dest_unit_in_tile ? (dest_value.y + 0.5) * this.data.map.tile_height : dest_value.y,
        };
        const direction = new Phaser.Point(dest.x - this.char.sprite.x, dest.y - this.char.sprite.y).normalize();
        const follow_time = this.camera_follow_time ?? MoveEvent.START_FOLLOW_TIME;
        let follow_resolve;
        const follow_promise = new Promise(resolve => (follow_resolve = resolve));
        if (this.camera_follow) {
            this.game.camera.unfollow();
            this.game.add
                .tween(this.game.camera)
                .to(
                    {
                        x: this.char.sprite.x - (numbers.GAME_WIDTH >> 1),
                        y: this.char.sprite.y - (numbers.GAME_HEIGHT >> 1),
                    },
                    follow_time,
                    Phaser.Easing.Linear.None,
                    true
                )
                .onComplete.addOnce(() => {
                    this.char.camera_follow();
                    follow_resolve();
                });
        } else {
            follow_resolve();
        }
        await follow_promise;
        this.char.set_speed(direction.x, direction.y, false);
        const sqr = x => x * x;
        const minimal_distance_sqr = sqr(this.minimal_distance ?? MoveEvent.MINIMAL_DISTANCE);
        if (!this.is_npc) {
            this.data.game_event_manager.allow_char_to_move = true;
        }
        const udpate_callback = () => {
            this.char.update_movement(true);
            if (sqr(dest.x - this.char.sprite.x) + sqr(dest.y - this.char.sprite.y) < minimal_distance_sqr) {
                this.data.game_event_manager.remove_callback(udpate_callback);
                this.char.stop_char();
                if (this.final_direction !== null) {
                    this.char.set_direction(this.final_direction, true);
                }
                if (this.camera_follow) {
                    this.game.camera.unfollow();
                    if (this.follow_hero_on_finish) {
                        this.game.add
                            .tween(this.game.camera)
                            .to(
                                {
                                    x: this.data.hero.sprite.x - (numbers.GAME_WIDTH >> 1),
                                    y: this.data.hero.sprite.y - (numbers.GAME_HEIGHT >> 1),
                                },
                                follow_time,
                                Phaser.Easing.Linear.None,
                                true
                            )
                            .onComplete.addOnce(() => {
                                this.data.hero.camera_follow();
                                this.finish();
                            });
                    }
                } else {
                    this.finish();
                }
            }
        };
        this.data.game_event_manager.add_callback(udpate_callback);
    }

    finish() {
        if (!this.is_npc) {
            this.data.game_event_manager.allow_char_to_move = false;
        }
        this.char.dashing = false;
        if (!this.keep_npc_collision_disable) {
            this.data.collision.enable_npc_collision(this.data.map.collision_layer);
        }
        if (this.deactive_char_on_end) {
            this.char.toggle_active(false);
        }
        --this.data.game_event_manager.events_running_count;
        this.finish_events.forEach(event => event.fire(this.origin_npc));
    }
}
