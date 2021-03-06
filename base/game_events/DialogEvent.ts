import {NPC} from "../NPC";
import {DialogManager} from "../utils/DialogManager";
import {GameEvent, event_types} from "./GameEvent";
import {Button} from "../XGamepad";

export class DialogEvent extends GameEvent {
    private text: string;
    private avatar: string;
    private dialog_manager: DialogManager = null;
    private running: boolean = false;
    private control_enable: boolean = true;
    private npc_hero_reciprocal_look: boolean = false;
    private reset_reciprocal_look: boolean = true;
    private finish_events: GameEvent[] = [];
    private previous_npc_direction: number;

    constructor(game, data, active, text, avatar, npc_hero_reciprocal_look, reset_reciprocal_look, finish_events) {
        super(game, data, event_types.DIALOG, active);
        this.text = text;
        this.avatar = avatar;
        this.npc_hero_reciprocal_look = npc_hero_reciprocal_look ?? false;
        this.reset_reciprocal_look = reset_reciprocal_look ?? true;

        this.data.control_manager.add_controls(
            [
                {
                    button: Button.A,
                    on_down: () => {
                        if (!this.active || !this.running || !this.control_enable) return;
                        this.next();
                    },
                },
            ],
            {persist: true}
        );

        if (finish_events !== undefined) {
            finish_events.forEach(event_info => {
                const event = this.data.game_event_manager.get_event_instance(event_info);
                this.finish_events.push(event);
            });
        }
    }

    next() {
        this.control_enable = false;
        this.dialog_manager.next(async finished => {
            this.control_enable = true;
            if (finished) {
                if (this.origin_npc && this.npc_hero_reciprocal_look && this.reset_reciprocal_look) {
                    await this.origin_npc.face_direction(this.previous_npc_direction);
                }
                this.running = false;
                --this.data.game_event_manager.events_running_count;
                this.finish_events.forEach(event => event.fire(this.origin_npc));
            }
        });
    }

    async _fire(origin_npc?: NPC) {
        if (!this.active) return;
        ++this.data.game_event_manager.events_running_count;
        this.control_enable = false;
        this.running = true;
        this.origin_npc = origin_npc;
        if (this.origin_npc && this.npc_hero_reciprocal_look) {
            this.previous_npc_direction = this.origin_npc.current_direction;
            await this.data.game_event_manager.set_npc_and_hero_directions(this.origin_npc);
        }
        this.dialog_manager = new DialogManager(this.game, this.data);
        this.dialog_manager.set_dialog(this.text, this.avatar);
        this.next();
    }
}
