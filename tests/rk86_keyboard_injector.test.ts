import { expect, test } from "bun:test";

import { type SequenceAction, convert_keyboard_sequence } from "../src/lib/rk86_keyboard_injector.js";

const sequence: SequenceAction[] = [
    { keys: [68, 188, 70, 70, 70], duration: 100, action: "press" },
    { keys: [13], duration: 100, action: "press" },
    { keys: 0, duration: 300, action: "pause" },
    { keys: [17, 67], duration: 100, action: "down" },
    { keys: [67, 17], duration: 100, action: "up" },
];

test("convert_keyboard_sequence", () => {
    const expected: SequenceAction[] = [
        { keys: [68], duration: 100, action: "down" },
        { keys: [68], duration: 100, action: "up" },
        { keys: [188], duration: 100, action: "down" },
        { keys: [188], duration: 100, action: "up" },
        { keys: [70], duration: 100, action: "down" },
        { keys: [70], duration: 100, action: "up" },
        { keys: [70], duration: 100, action: "down" },
        { keys: [70], duration: 100, action: "up" },
        { keys: [70], duration: 100, action: "down" },
        { keys: [70], duration: 100, action: "up" },
        { keys: [13], duration: 100, action: "down" },
        { keys: [13], duration: 100, action: "up" },
        { keys: [0], duration: 300, action: "pause" },
        { keys: [17, 67], duration: 100, action: "down" },
        { keys: [67, 17], duration: 100, action: "up" },
    ];
    expect(convert_keyboard_sequence(sequence)).toEqual(expected);
});
