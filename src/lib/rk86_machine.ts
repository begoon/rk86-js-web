import type { UI } from "../../main.js";
import type { IO } from "../../test_machine.js";
import type { I8080 } from "./i8080.ts";
import type { Keyboard } from "./rk86_keyboard.ts";
import type { Memory } from "./rk86_memory.js";
import type { Runner } from "./rk86_runner.js";
import type { Screen } from "./rk86_screen.js";
import type { Tape } from "./rk86_tape.js";

export interface Machine {
    ui: UI;
    cpu: I8080;
    memory: Memory;
    io: IO;
    keyboard: Keyboard;
    runner: Runner;
    screen: Screen;
    tape: Tape;
    font: string;

    reset: () => void;
    restart: () => void;
    pause: (paused: boolean) => void;
}

export interface MachineBuilder {
    ui?: UI;
    cpu?: I8080;
    memory?: Memory;
    io: IO;
    keyboard: Keyboard;
    runner?: Runner;
    screen?: Screen;
    tape?: Tape;
    font: string;
}
