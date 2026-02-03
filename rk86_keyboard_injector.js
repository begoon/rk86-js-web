/**
 * @typedef {Object} SequenceAction
 * @property {number|number[]} keys
 * @property {number} duration
 * @property {"press"|"down"|"up"} action
 */

/**
 * @param {SequenceAction[]} seq
 * @returns {SequenceAction[]}
 */
export function convert_keyboard_sequence(seq) {
    /**
     * @type {SequenceAction[]}
     */
    const queue = [];
    seq.forEach(({ keys: keys_, duration, action }) => {
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
