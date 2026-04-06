export interface SequenceAction {
    keys: number | number[];
    duration: number;
    action: "press" | "down" | "up" | "pause";
}

export function convert_keyboard_sequence(sequence: SequenceAction[]): SequenceAction[] {
    const queue: SequenceAction[] = [];
    sequence.forEach(({ keys: keys_, duration, action }) => {
        const keys = typeof keys_ === "number" ? [keys_] : keys_;
        if (action === "press") {
            keys.forEach((key) => {
                queue.push({ keys: [key], duration, action: "down" });
                queue.push({ keys: [key], duration, action: "up" });
            });
        } else {
            queue.push({ keys, duration, action });
        }
    });
    return queue;
}
