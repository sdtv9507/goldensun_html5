export class SpriteBase {
    public key_name: string;
    public actions: {
        [action: string]: {
            animations?: string[];
            frame_counts?: any;
            frame_rate?: {[animation: string]: any};
            loop?: boolean | boolean[];
            spritesheet?: {image: string; json: string};
        };
    };
    public animations: {[action: string]: {[animation: string]: string[]}};

    constructor(key_name, actions) {
        this.key_name = key_name;
        this.actions = {};
        this.animations = {};
        for (let i = 0; i < actions.length; ++i) {
            this.actions[actions[i]] = {};
        }
    }

    setActionAnimations(action, animations, frame_counts) {
        this.actions[action].animations = new Array(animations.length);
        this.actions[action].frame_counts = new Array(animations.length);
        const frame_count_is_array = Array.isArray(frame_counts);
        for (let i = 0; i < animations.length; ++i) {
            const frame_count = frame_count_is_array ? frame_counts[i] : frame_counts;
            this.actions[action].animations[i] = animations[i];
            this.actions[action].frame_counts[i] = frame_count;
        }
    }

    setActionFrameRate(action, frame_rate) {
        this.actions[action].frame_rate = {};
        for (let i = 0; i < this.actions[action].animations.length; ++i) {
            const animation = this.actions[action].animations[i];
            let this_frame_rate;
            if (Array.isArray(frame_rate)) {
                if (frame_rate.length === 1) {
                    this_frame_rate = frame_rate[0];
                } else {
                    this_frame_rate = frame_rate[i];
                }
            } else {
                this_frame_rate = frame_rate;
            }
            this.actions[action].frame_rate[animation] = this_frame_rate;
        }
    }

    setActionLoop(action, loop) {
        this.actions[action].loop = loop;
    }

    setActionSpritesheet(action, spritesheet_image_url, spritesheet_json_url) {
        this.actions[action].spritesheet = {
            image: spritesheet_image_url,
            json: spritesheet_json_url,
        };
    }

    hasAction(action: string) {
        return action in this.actions;
    }

    hasAnimation(action: string, animation: string) {
        return animation in this.animations[action];
    }

    loadSpritesheets(game, force_load, on_load_complete) {
        for (let action in this.actions) {
            const spritesheet = this.actions[action].spritesheet;
            const action_key = this.getSpriteKey(action);
            let loader = game.load.atlasJSONHash(action_key, spritesheet.image, spritesheet.json);
            if (force_load) {
                loader.onLoadComplete.addOnce(on_load_complete, this);
                game.load.start();
            }
        }
    }

    generateFrameNames(action, animation, start, stop, suffix, zeroPad) {
        if (!(action in this.animations)) {
            this.animations[action] = {};
        }
        this.animations[action][animation] = Phaser.Animation.generateFrameNames(
            `${action}/${animation}/`,
            start,
            stop,
            suffix,
            zeroPad
        );
    }

    setAnimation(sprite: Phaser.Sprite, action) {
        const animations = this.actions[action].animations;
        const loop = this.actions[action].loop === undefined ? true : this.actions[action].loop;
        for (let i = 0; i < animations.length; ++i) {
            const animation = animations[i];
            const frame_rate = this.actions[action].frame_rate[animation];
            const anim_key = this.getAnimationKey(action, animation);
            sprite.animations.add(
                anim_key,
                this.animations[action][animation],
                frame_rate,
                Array.isArray(loop) ? loop[i] : loop,
                false
            );
        }
    }

    generateAllFrames() {
        for (let action in this.actions) {
            const animations = this.actions[action].animations;
            const frame_counts = this.actions[action].frame_counts;
            for (let i = 0; i < animations.length; ++i) {
                const animation = animations[i];
                this.generateFrameNames(action, animation, 0, frame_counts[i] - 1, "", 2);
            }
        }
    }

    getFrameName(action, animation, index) {
        const formatted_index = index.toLocaleString("en-US", {minimumIntegerDigits: 2, useGrouping: false});
        return `${action}/${animation}/${formatted_index}`;
    }

    getSpriteKey(action) {
        return `${this.key_name}_${action}`;
    }

    getAnimationKey(action, animation) {
        return `${action}_${animation}`;
    }

    getSpriteAction(sprite) {
        const key = sprite.key;
        return key.substring(key.lastIndexOf("_") + 1, key.length);
    }
}
