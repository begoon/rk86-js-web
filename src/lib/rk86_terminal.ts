// Terminal-based RK86 emulator — renders the screen as Unicode text in a terminal.
// Usage: bun src/lib/rk86_terminal.ts [program.GAM]

globalThis.Image = class {} as any;

import { I8080 } from "./i8080.js";
import * as FileParser from "./rk86_file_parser.js";
import { rk86_font_image } from "./rk86_font.js";
import { Keyboard } from "./rk86_keyboard.js";
import type { Machine, MachineBuilder } from "./rk86_machine.js";
import { Memory } from "./rk86_memory.js";
import { Runner } from "./rk86_runner.js";
import { Screen } from "./rk86_screen.js";
import { Tape } from "./rk86_tape.js";

// --- RK86 byte → Unicode character mapping ---
// Built from rk86_font.bmp analysis.
// 0x00-0x1F: pseudo-graphics (block elements)
// 0x20-0x5F: standard ASCII
// 0x60-0x7F: Russian Cyrillic (uppercase)
// 0x80-0xFF: same as 0x00-0x7F (inverse video on real hardware)

const charMap: Record<number, string> = {
    0x00 /* empty       */: " ",
    0x01 /* ▘ top-left  */: "▘",
    0x02 /* ▝ top-right */: "▝",
    0x03 /* ▀ top-half  */: "▀",
    0x04 /* ▖ bot-left  */: "▖",
    0x05 /* ▌ left-half */: "▌",
    0x06 /* ▞ diagonal  */: "▞",
    0x07 /* ▛ 3/4       */: "▛",
    0x08 /* empty       */: " ",
    0x09 /* flower      */: "✿",
    0x0a /* empty       */: " ",
    0x0b /* ↑ arrow up  */: "↑",
    0x0c /* empty       */: " ",
    0x0d /* empty       */: " ",
    0x0e /* ◀ arrow left*/: "◀",
    0x0f /* ▼ arrow down*/: "▼",
    0x10 /* ▗ bot-right */: "▗",
    0x11 /* ▚ diagonal  */: "▚",
    0x12 /* ▐ right-half*/: "▐",
    0x13 /* ▜ 3/4       */: "▜",
    0x14 /* ▄ bot-half  */: "▄",
    0x15 /* ▙ 3/4       */: "▙",
    0x16 /* ▟ 3/4       */: "▟",
    0x17 /* █ full block*/: "█",
    0x18 /* empty       */: " ",
    0x19 /* empty       */: " ",
    0x1a /* empty       */: " ",
    0x1b /* │ vert line */: "│",
    0x1c /* ─ horiz line*/: "─",
    0x1d /* ▶ arrow rght*/: "▶",
    0x1e /* ⌐ connector */: "⌐",
    0x1f /* empty       */: " ",

    0x20 /* space       */: " ",
    0x21 /* !           */: "!",
    0x22 /* "           */: "\"",
    0x23 /* #           */: "#",
    0x24 /* $           */: "$",
    0x25 /* %           */: "%",
    0x26 /* &           */: "&",
    0x27 /* '           */: "'",
    0x28 /* (           */: "(",
    0x29 /* )           */: ")",
    0x2a /* *           */: "*",
    0x2b /* +           */: "+",
    0x2c /* ,           */: ",",
    0x2d /* -           */: "-",
    0x2e /* .           */: ".",
    0x2f /* /           */: "/",

    0x30 /* 0           */: "0",
    0x31 /* 1           */: "1",
    0x32 /* 2           */: "2",
    0x33 /* 3           */: "3",
    0x34 /* 4           */: "4",
    0x35 /* 5           */: "5",
    0x36 /* 6           */: "6",
    0x37 /* 7           */: "7",
    0x38 /* 8           */: "8",
    0x39 /* 9           */: "9",
    0x3a /* :           */: ":",
    0x3b /* ;           */: ";",
    0x3c /* <           */: "<",
    0x3d /* =           */: "=",
    0x3e /* >           */: ">",
    0x3f /* ?           */: "?",

    0x40 /* @           */: "@",
    0x41 /* A           */: "A",
    0x42 /* B           */: "B",
    0x43 /* C           */: "C",
    0x44 /* D           */: "D",
    0x45 /* E           */: "E",
    0x46 /* F           */: "F",
    0x47 /* G           */: "G",
    0x48 /* H           */: "H",
    0x49 /* I           */: "I",
    0x4a /* J           */: "J",
    0x4b /* K           */: "K",
    0x4c /* L           */: "L",
    0x4d /* M           */: "M",
    0x4e /* N           */: "N",
    0x4f /* O           */: "O",

    0x50 /* P           */: "P",
    0x51 /* Q           */: "Q",
    0x52 /* R           */: "R",
    0x53 /* S           */: "S",
    0x54 /* T           */: "T",
    0x55 /* U           */: "U",
    0x56 /* V           */: "V",
    0x57 /* W           */: "W",
    0x58 /* X           */: "X",
    0x59 /* Y           */: "Y",
    0x5a /* Z           */: "Z",
    0x5b /* [           */: "[",
    0x5c /* \           */: "\\",
    0x5d /* ]           */: "]",
    0x5e /* ^           */: "^",
    0x5f /* _           */: "_",

    0x60 /* Ю           */: "Ю",
    0x61 /* А           */: "А",
    0x62 /* Б           */: "Б",
    0x63 /* Ц           */: "Ц",
    0x64 /* Д           */: "Д",
    0x65 /* Е           */: "Е",
    0x66 /* Ф           */: "Ф",
    0x67 /* Г           */: "Г",
    0x68 /* Х           */: "Х",
    0x69 /* И           */: "И",
    0x6a /* Й           */: "Й",
    0x6b /* К           */: "К",
    0x6c /* Л           */: "Л",
    0x6d /* М           */: "М",
    0x6e /* Н           */: "Н",
    0x6f /* О           */: "О",

    0x70 /* П           */: "П",
    0x71 /* Я           */: "Я",
    0x72 /* Р           */: "Р",
    0x73 /* С           */: "С",
    0x74 /* Т           */: "Т",
    0x75 /* У           */: "У",
    0x76 /* Ж           */: "Ж",
    0x77 /* В           */: "В",
    0x78 /* Ь           */: "Ь",
    0x79 /* Ы           */: "Ы",
    0x7a /* З           */: "З",
    0x7b /* Ш           */: "Ш",
    0x7c /* Э           */: "Э",
    0x7d /* Щ           */: "Щ",
    0x7e /* Ч           */: "Ч",
    0x7f /* █ full block*/: "█",
};

// 0x80-0xFF: inverse video mirror of 0x00-0x7F
for (let i = 0; i < 128; i++) charMap[0x80 + i] = charMap[i];

function rk86char(byte: number): string {
    return charMap[byte & 0xff] ?? "·";
}

// --- Minimal UI stub for terminal ---

class TerminalUI {
    canvas = { getContext: () => null, width: 0, height: 0 };
    visualizer_visible = false;
    terminal = { put: () => {}, history: [] as string[] };
    i8080disasm: unknown;
    visualizer: unknown;
    toggle_assembler: (() => void) | undefined;
    on_visualizer_hit: ((opcode: number) => void) | undefined;
    on_pause_changed: ((value: boolean) => void) | undefined;
    refreshDebugger: (() => void) | undefined;

    resize_canvas() {}
    update_screen_geometry() {}
    update_video_memory_address() {}
    update_ruslat = () => {};
    update_activity_indicator = () => {};
    update_written_bytes = () => {};
    hightlight_written_bytes = () => {};
    start_update_perf = () => {};
    screenshot() {}
    memory_snapshot() {}
    emulator_snapshot() {}
}

class IO {
    input = (_port: number): number => 0;
    output = (_port: number, _w8: number): void => {};
    interrupt = (_iff: number): void => {};
}

// --- Terminal screen renderer ---

class TerminalScreen {
    machine: Machine;
    width = 78;
    height = 30;
    video_memory_base = 0;
    timer: ReturnType<typeof setTimeout> | undefined;

    constructor(machine: Machine) {
        this.machine = machine;
    }

    start() {
        this.render();
    }

    render() {
        const { memory, screen } = this.machine;
        const cursorX = screen.cursor_x;
        const cursorY = screen.cursor_y;
        const cursorVisible = screen.cursor_state;

        let output = "\x1b[H"; // cursor home

        let addr = this.video_memory_base;
        for (let y = 0; y < this.height; y++) {
            let line = "";
            for (let x = 0; x < this.width; x++) {
                const ch = rk86char(memory.read(addr));
                if (x === cursorX && y === cursorY) {
                    line += `\x1b[4m${ch}\x1b[0m`; // underline
                } else {
                    line += ch;
                }
                addr++;
            }
            output += line + "\n";
        }

        process.stdout.write(output);
        this.timer = setTimeout(() => this.render(), 40); // 25fps
    }
}

// --- Keyboard input from terminal stdin ---

const KEY_MAP: Record<string, string> = {
    a: "KeyA",
    b: "KeyB",
    c: "KeyC",
    d: "KeyD",
    e: "KeyE",
    f: "KeyF",
    g: "KeyG",
    h: "KeyH",
    i: "KeyI",
    j: "KeyJ",
    k: "KeyK",
    l: "KeyL",
    m: "KeyM",
    n: "KeyN",
    o: "KeyO",
    p: "KeyP",
    q: "KeyQ",
    r: "KeyR",
    s: "KeyS",
    t: "KeyT",
    u: "KeyU",
    v: "KeyV",
    w: "KeyW",
    x: "KeyX",
    y: "KeyY",
    z: "KeyZ",
    "0": "Digit0",
    "1": "Digit1",
    "2": "Digit2",
    "3": "Digit3",
    "4": "Digit4",
    "5": "Digit5",
    "6": "Digit6",
    "7": "Digit7",
    "8": "Digit8",
    "9": "Digit9",
    "\r": "Enter",
    "\n": "Enter",
    "\t": "Tab",
    "\x7f": "Backspace",
    "\b": "Backspace",
    " ": "Space",
    ",": "Comma",
    ".": "Period",
    "/": "Slash",
    ";": "Semicolon",
    "-": "Minus",
    "[": "BracketLeft",
    "]": "BracketRight",
    "\\": "Backslash",
    "`": "Backquote",
    "'": "Quote",
    "\x1b[A": "ArrowUp",
    "\x1b[B": "ArrowDown",
    "\x1b[C": "ArrowRight",
    "\x1b[D": "ArrowLeft",
    "\x1bOP": "F1",
    "\x1bOQ": "F2",
    "\x1bOR": "F3",
    "\x1bOS": "F4",
    "\x1b[15~": "F5",
    "\x1b[17~": "F6",
    "\x1b[18~": "F7",
    "\x1b[19~": "F8",
    "\x1b[20~": "F9",
    "\x1b[21~": "F10",
};

function setupKeyboard(keyboard: Keyboard) {
    if (!process.stdin.isTTY) return;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (data: string) => {
        // Ctrl+C to exit
        if (data === "\x03") {
            process.stdout.write("\x1b[?25h"); // show cursor
            process.stdout.write("\x1b[2J\x1b[H"); // clear screen
            process.exit(0);
        }

        const code = KEY_MAP[data] || KEY_MAP[data.toLowerCase()];
        if (code) {
            // Check for uppercase → send shift
            if (data.length === 1 && data >= "A" && data <= "Z") {
                keyboard.onkeydown("ShiftLeft");
            }
            keyboard.onkeydown(code);
            setTimeout(() => {
                keyboard.onkeyup(code);
                if (data.length === 1 && data >= "A" && data <= "Z") {
                    keyboard.onkeyup("ShiftLeft");
                }
            }, 50);
        }
    });
}

// --- File loading ---

async function fetchFile(name: string): Promise<number[] | undefined> {
    try {
        const data = await Bun.file(`static/files/${name}`).arrayBuffer();
        return Array.from(new Uint8Array(data));
    } catch {
        console.error(`ошибка загрузки файла: ${name}`);
    }
}

// --- Main ---

async function main() {
    const programFile = process.argv[2];

    const keyboard = new Keyboard();
    const io = new IO();

    const machineBuilder: MachineBuilder = {
        font: rk86_font_image(),
        keyboard,
        io,
    };
    const machine = machineBuilder as Machine;

    machine.ui = new TerminalUI() as any;
    machine.memory = new Memory(machine);
    machine.cpu = new I8080(machine);
    machine.screen = new Screen(machine);
    machine.tape = new Tape(machine);
    machine.runner = new Runner(machine);

    machine.memory.update_ruslat = machine.ui.update_ruslat;

    // Load monitor ROM
    const monitorContent = await fetchFile("mon32.bin");
    if (!monitorContent) {
        console.error("ошибка загрузки монитора mon32.bin");
        process.exit(1);
    }
    const monitorFile = FileParser.parse_rk86_binary("mon32.bin", monitorContent);
    machine.memory.load_file(monitorFile);

    // Load program if specified
    if (programFile) {
        const content = await fetchFile(programFile);
        if (content) {
            const file = FileParser.parse_rk86_binary(programFile, content);
            machine.memory.load_file(file);
            console.error(
                `загружен: ${programFile} (${file.start.toString(16)}-${file.end.toString(16)}, G${file.entry.toString(16)})`,
            );
        }
    }

    // Setup terminal
    process.stdout.write("\x1b[?25l"); // hide cursor
    process.stdout.write("\x1b[2J"); // clear screen

    // Setup keyboard
    setupKeyboard(keyboard);

    // Start terminal renderer
    const termScreen = new TerminalScreen(machine);

    // Hook screen geometry changes from the real Screen to our terminal renderer
    const origSetGeometry = machine.screen.set_geometry.bind(machine.screen);
    machine.screen.set_geometry = (width: number, height: number) => {
        origSetGeometry(width, height);
        termScreen.width = width;
        termScreen.height = height;
    };

    const origSetVideoMemory = machine.screen.set_video_memory.bind(machine.screen);
    machine.screen.set_video_memory = (base: number) => {
        origSetVideoMemory(base);
        termScreen.video_memory_base = base;
    };

    // Stub canvas methods on the Screen — we render via terminal instead
    const noopCtx = {
        imageSmoothingEnabled: false,
        fillStyle: "",
        fillRect() {},
        drawImage() {},
        clearRect() {},
    };
    machine.screen.ctx = noopCtx as unknown as CanvasRenderingContext2D;
    machine.screen.init = () => {
        machine.screen.ctx = noopCtx as unknown as CanvasRenderingContext2D;
    };
    machine.screen.draw_screen = () => {}; // we render ourselves
    machine.screen.draw_cursor = () => {}; // skip canvas cursor drawing
    // flip_cursor still runs to toggle cursor_state for our terminal renderer
    machine.screen.start();

    machine.runner.execute();
    termScreen.start();

    // Cleanup on exit
    process.on("exit", () => {
        process.stdout.write("\x1b[?25h"); // show cursor
    });
}

main();
