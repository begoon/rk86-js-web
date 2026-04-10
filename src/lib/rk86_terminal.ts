// Terminal-based RK86 emulator — renders the screen as Unicode text in a terminal.
// Usage: bun src/lib/rk86_terminal.ts [program.GAM]

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { I8080 } from "./i8080.js";
import * as FileParser from "./rk86_file_parser.js";
import { rk86_font_image } from "./rk86_font.js";
import { Keyboard } from "./rk86_keyboard.js";
import type { Machine, MachineBuilder } from "./rk86_machine.js";
import { Memory } from "./rk86_memory.js";
import type { Renderer } from "./rk86_renderer.js";
import { Runner } from "./rk86_runner.js";
import { Screen } from "./rk86_screen.js";
import { rk86_snapshot_restore } from "./rk86_snapshot.js";
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
    0x04 /* ▗ bot-right */: "▗",
    0x05 /* ▚ diagonal  */: "▚",
    0x06 /* ▐ right-half*/: "▐",
    0x07 /* ▜ 3/4       */: "▜",
    0x08 /* empty       */: " ",
    0x09 /* flower      */: "✿",
    0x0a /* empty       */: " ",
    0x0b /* ↑ arrow up  */: "↑",
    0x0c /* empty       */: " ",
    0x0d /* empty       */: " ",
    0x0e /* ◀ arrow left*/: "◀",
    0x0f /* ▼ arrow down*/: "▼",
    0x10 /* ▖ bot-left  */: "▖",
    0x11 /* ▌ left-half */: "▌",
    0x12 /* ▞ diagonal  */: "▞",
    0x13 /* ▛ 3/4       */: "▛",
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
    0x22 /* "           */: '"',
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

// --- Terminal renderer ---

class TerminalRenderer implements Renderer {
    private machine!: Machine;

    connect(machine: Machine): void {
        this.machine = machine;
    }

    update(): void {
        const { memory, screen } = this.machine;

        const dim = "\x1b[2m";
        const reset = "\x1b[0m";
        const w = screen.width;

        let output = "\x1b[H"; // cursor home
        output += `${dim}┌${"─".repeat(w)}┐${reset}\n`;

        let addr = screen.video_memory_base;
        for (let y = 0; y < screen.height; y++) {
            let line = `${dim}│${reset}`;
            for (let x = 0; x < w; x++) {
                const ch = rk86char(memory.read(addr));
                if (x === screen.cursor_x && y === screen.cursor_y) {
                    line += `\x1b[4m${ch}${reset}`;
                } else {
                    line += ch;
                }
                addr++;
            }
            line += `${dim}│${reset}`;
            output += line + "\n";
        }
        output += `${dim}└${"─".repeat(w)}┘${reset}\n`;

        process.stdout.write(output);
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

// --- Embedded monitor ROM (mon32.bin, 2KB) ---

const MON32_B64 =
    "wzb4w2P+w5j7w7r8w0b8w7r8wwH+w6X8wyL5w3L+w3v6w3/6w7b6w0n7wxb7w876" +
    "w1L/w1b/PooyA4Axz3bNzvohAHYRX3YOAM3t+SHPdiIcdiFa/80i+c3O+iH/dSIx" +
    "diEqHSIvdj7DMiZ2Mc92IWb/zSL5MgKAPTICoM3u+CFs+OUhM3Z+/ljK0//+VcoA" +
    "8PXNLPkqK3ZNRCopdusqJ3bx/kTKxfn+Q8rX+f5Gyu35/lPK9Pn+VMr/+f5Nyib6" +
    "/kfKP/r+ScqG+v5Pyi37/kzKCPr+Uspo+sMA8D4zvcrx+OUhnv/NIvnhK8Pz+CEz" +
    "dgYAzWP+/gjK3Pj+f8rc+MS5/Hf+Dcoa+f4uymz4Bv8+Ur3Krvojw/P4eBcRM3YG" +
    "AMl+p8jNufwjwyL5ISd2ES12DgDN7fkRNHbNWvkiJ3YiKXbYPv8yLXbNWvkiKXbY" +
    "zVr5Iit22MOu+iEAABoT/g3Kjvn+LMj+IMpd+dYw+q76/gr6gvn+Efqu+v4X8q76" +
    "1gdPKSkpKdqu+gnDXfk3yXy6wH27yc2k+c2Q+cKi+TMzySPJzXL+/gPAzc76w676" +
    "5SFs/80i+eHJfsXNpfw+IM25/MHJzXj7zbn5zZb5feYPysX5w8j5Cr7K5vnNePvN" +
    "ufkKzbr5A82W+cPX+XHNmfnD7fl5vsx4+82W+cP0+X4CA82Z+cP/+c14+363+hX6" +
    "/iDSF/o+Ls25/M2W+X3mD8oI+sML+s14+825+eXN7vjh0jv65c1a+X3hdyPDJvrN" +
    "kPnKWvrrIiN2fjIldjb3PsMyMAAhov8iMQAxGHbB0eHx+SoWdsMmdj6QMgOgIgGg" +
    "OgCgAgPNmfnDbfoqAnbJ5SoAdn7hyTotdrfKkfp7Mi92zbb6zXj76814++vFzRb7" +
    "YGnNePvRzZD5yOvNePs+P825/MNs+D7/zf/65Qnrzf364Qnr5c0K+z7/zf/64eUh" +
    "AcA2ACs2TTYdNpk2kyM2J35+5iDK4fohCOA2gC4ENtA2diw2IzZJLgg2pOHJPgjN" +
    "mPtHPgjNmPtPyT4IzZj7d82Z+cMK+wEAAH6BT/XNkPnKn/nxeI5HzZn5wxn7ebfK" +
    "NfsyMHblzRb74c14++vNePvr5WBpzXj74cUBAADNRvwF4+PCTfsO5s1G/M2Q++vN" +
    "kPvrzYb7IQAAzZD7DubNRvzhzZD7w876xc2w+XzNpfx9zbr5wclOzUb8zZn5w4b7" +
    "TM1G/E3DRvzlxdVXPoAyCOAhAAA5MQAAIg12DgA6AoAPDw8P5gFf8XnmfwdPJgAl" +
    "yjT88ToCgA8PDw/mAbvKv/uxTxU6L3bC3PvWEkfxBcLd+xQ6AoAPDw8P5gFferf" +
    "yC/x5/ubC//uvMi52wwn8/hnCt/s+/zIudhYJFcK3+yEE4DbQNnYjNiM2ST4nMgH" +
    "APuAyAcAuCDakKg12+ToudqnDofwqDXb5zc76erfyrvrNpPnDnPvlxdX1PoAyCOAh" +
    "AAA5MQAAFgjxeQdPPgGpMgKAOjB2R/EFwmb8PgCpMgKAFTowdsJ6/NYOR/EFwnv8" +
    "FBXCWPz5IQTgNtA2diM2IzZJPicyAcA+4DIBwC4INqTx0cHhyfUPDw8Pza788eYP" +
    "/gr6t/zGB8YwT/XF1eXNAf4hhf3lKgJ26yoAdjoEdj367vzKZf3ic/151iBPDfrp/" +
    "MXNuf3Bw938rzIEdsl55n9P/h/Ko/3+DMqy/f4NyvP9/grKR/3+CMrW/f4Yyrn9/h" +
    "nK4v3+GsrF/f4byp79/gfCOP0B8AV4+z3CKP148z3CLv0Nwif9yXHNuf16/gPAe/" +
    "4IwM3i/Xr+G8LF/eXVIcJ3ERB4AZ4HGncjEwt5sMJY/dHhyXn+WcLp/M2y/T4C" +
    "w+r8edYgTw0+BPrq/MXNxf3Bw3f9IgB26yICdj6AMgHAfTIAwHwyAMDh0cHxyT4B" +
    "w+r8IfR/ESUJr3crG3uywqn9EQgDIcJ3yXsjHP5HwB4IAcD/CXr+GwFOAMLT/RYC" +
    "AbD4FAnJeysd/gjAHkcBQAAJev4DAbL/wvD9FhwBUAcVCcl9k9L5/SVvHggBCAAJ" +
    "yToCgOaAyg7+OgV2t8DlKgl2zXL+vW/KKv4+ATILdiYVryIJduEyBXbJJcIh/jzK" +
    "Iv48ylH+xQEDUM0n/cE6C3Ym4D0yC3bKTP4mQD7/wyL+OgKA5oDKUf46BnYvMgZ2" +
    "wxr+zQH+t8pj/q8yBXY6CXbJOgKA5oDCff4+/smvMgCAMgKAOgZ25gH2BjIDgDoB" +
    "gDzCl/49yeUuASYHfQ9vLzIAgDoBgC+3wrP+JfKc/j7/4ckuIDoBgC+3yq/+LcK1" +
    "/i4ILQfSw/58ZW/+Acr6/trz/gcHB8YgtP5fwgb/PiDhyQkKDX8IGRgaDB8bAAEC" +
    "AwQFfCHq/sP+/nwh4v6Fb37+QOHY5W86AoBn5kDCGv99/kD6P//mH+HJOgZ2t8oq" +
    "/33+QPoq//Ygb3zmIMI//33+QPo7/33uIOHJfeYvb33+QOHw5W/mD/4MffpQ/+4Q" +
    "4ckqMXbJIjF2yR9yYWRpby04NnJrAA0KLS0+AA0KGBgYGAANCiBQQy0NCiBITC0N" +
    "CiBCQy0NCiBERS0NCiBTUC0NCiBBRi0ZGRkZGRkACCAIACIWdvXhIh524SsiFHYh" +
    "AAA5MR525dXFKhR2Mc92zXj76yojds2Q+cJs+DoldnfDbPghc//NIvkhFHYGBl4j" +
    "VsXl6814+83u+NL2/81a+dHV63Irc+HBBSPC3v/J//8=";

function decodeMon32(): number[] {
    return Array.from(new Uint8Array(Uint8Array.from(atob(MON32_B64), (c) => c.charCodeAt(0))));
}

// --- File loading ---

async function fetchFile(name: string): Promise<number[]> {
    if (!existsSync(name)) {
        console.error(`файл не найден: ${name}`);
        process.exit(1);
    }
    const data = await readFile(name);
    return Array.from(data);
}

// --- Help and file listing ---

function printHelp() {
    console.log(`Эмулятор Радио-86РК (терминал)

Использование: bunx rk86 [опции] [файл]

Опции:
  -h              справка
  -l              список файлов из каталога
  -m <файл>       монитор (по умолчанию: встроенный mon32.bin)
  -p              загрузить файл без запуска

Примеры:
  bunx rk86                  запуск монитора
  bunx rk86 CHESS.GAM        загрузить и запустить файл
  bunx rk86 -p CHESS.GAM     загрузить файл (без запуска)
  bunx rk86 -m mon16.bin     запуск с другим монитором
  bunx rk86 -l               список доступных файлов

Управление:
  Ctrl+C    выход`);
}

function htmlToAnsi(html: string): string {
    return html
        .replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/g, (_m, url, text) => `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`)
        .replace(/<[^>]*>/g, "")
        .replace(/\n+/g, " ")
        .trim();
}

async function listFiles() {
    const { catalog } = await import("./catalog_data.js");
    for (const entry of catalog) {
        const title = htmlToAnsi(entry.title);
        const desc = entry.description ? ` — ${htmlToAnsi(entry.description)}` : "";
        console.log(`\x1b[33m${entry.name.padEnd(20)}\x1b[0m ${title}${desc}`);
    }
}

// --- Main ---

async function main() {
    const args = process.argv.slice(2);

    if (args.includes("-h") || args.includes("--help")) {
        printHelp();
        process.exit(0);
    }

    if (args.includes("-l") || args.includes("--list")) {
        await listFiles();
        process.exit(0);
    }

    const loadOnly = args.includes("-p");
    const monitorIdx = args.indexOf("-m");
    const monitorFile_ = monitorIdx >= 0 ? args[monitorIdx + 1] : undefined;
    const positional = args.filter((a, i) => !a.startsWith("-") && (monitorIdx < 0 || i !== monitorIdx + 1));
    const programFile = positional[0];

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

    // Load monitor ROM (external or embedded)
    const monitorContent = monitorFile_ ? await fetchFile(monitorFile_) : decodeMon32();
    const monitorFile = FileParser.parse_rk86_binary(monitorFile_ || "mon32.bin", monitorContent);
    machine.memory.load_file(monitorFile);

    // Load program if specified
    let entryPoint: number | undefined;
    if (programFile) {
        const content = await fetchFile(programFile);
        const { ok, json } = FileParser.parse(content);
        if (ok) {
            rk86_snapshot_restore(json, machine);
            entryPoint = parseInt(json.cpu.pc);
            console.error(`загружен образ: ${programFile} (PC=${entryPoint.toString(16)})`);
        } else {
            const file = FileParser.parse_rk86_binary(programFile, content);
            machine.memory.load_file(file);
            entryPoint = file.entry;
            console.error(
                `загружен: ${programFile} (${file.start.toString(16)}-${file.end.toString(16)}, G${file.entry.toString(16)})`,
            );
        }
    }

    // Setup terminal
    process.stdout.write("\x1b[?25l"); // hide cursor
    process.stdout.write("\x1b[2J"); // clear screen

    setupKeyboard(keyboard);
    machine.screen.start(new TerminalRenderer());
    machine.runner.execute();

    // Autorun loaded file after monitor initializes
    if (entryPoint !== undefined && !loadOnly) {
        setTimeout(() => machine.cpu.jump(entryPoint!), 500);
    }

    // Cleanup on exit
    process.on("exit", () => {
        process.stdout.write("\x1b[?25h"); // show cursor
    });
}

main();
