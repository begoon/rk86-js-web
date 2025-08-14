import "./console-terminal.js";
import { hex16 } from "./hex.js";
import { I8080 } from "./i8080.js";
import Visualizer from "./i8080_visualizer.js";
import I8080DisasmPanel from "./i8080disasm_panel.js";
import * as KeyboardVisualizer from "./kbd-js.js";
import moveable from "./moveable.js";
import * as FileParser from "./rk86_file_parser.js";
import { rk86_font_image } from "./rk86_font.js";
import { Keyboard } from "./rk86_keyboard.js";
import { convert_keyboard_sequence } from "./rk86_keyboard_injector.js";
import { Memory } from "./rk86_memory.js";
import { Runner } from "./rk86_runner.js";
import { Screen } from "./rk86_screen.js";
import { rk86_snapshot, rk86_snapshot_restore } from "./rk86_snapshot.js";
import { Tape } from "./rk86_tape.js";
import { saveAs } from "./saver.js";
import { tape_catalog } from "./tape_catalog.js";

const elements = new Map();

/**
 * @param {string} id
 * @returns {!HTMLElement}
 */
const $ = (id) => {
    const cachedID = elements.get(id);
    if (cachedID) return cachedID;

    const element = document.getElementById(id);
    if (!element) throw new Error(`element "${id}" not found`);

    elements.set(id, element);
    return element;
};

// ---

class IO {
    constructor() {
        this.input = (port) => 0;
        this.output = (port, w8) => {};
        this.interrupt = (iff) => {};
    }
}

/**
 * class
 */
export class UI {
    constructor(machine) {
        this.machine = machine;

        /**
         * @type {HTMLCanvasElement}
         */
        this.canvas = /** @type {HTMLCanvasElement} */ ($("canvas"));
        if (!this.canvas || !this.canvas.getContext) {
            alert("Tag <canvas> is not supported in the browser");
            return;
        }

        /**
         * @type {HTMLElement}
         */
        this.ips = $("ips");
        /**
         * @type {HTMLElement}
         */
        this.tps = $("tps");

        this.meta_press_count = 0;

        this.command_mode = false;

        this.screenshot_name = "rk86-screen";
        this.screenshot_count = 1;

        this.memory_snapshot_name = "rk86-memory";
        this.memory_snapshot_count = 1;

        this.configureEventListeners();

        /** @type {import('./rk86_console.js').Console} */
        this.terminal;
    }

    start_update_perf = () => setInterval(() => this.update_perf(), 2000);

    /**
     * @param {number} width
     * @param {number} height
     */
    resize_canvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    fullscreen() {
        this.canvas.requestFullscreen();
    }

    reset() {
        this.machine.keyboard.reset();
        this.machine.cpu.jump(0xf800);
        console.log("%creset", "color: lightgreen; font-weight: bold");
    }

    restart() {
        this.machine.memory.zero_ram();
        this.reset();
    }

    update_ruslat = (value) => {
        $("ruslat").textContent = value ? "РУС" : "ЛАТ";
    };

    update_perf() {
        /**
         * @param {HTMLElement} element
         * @param {number} value
         */
        const update = (element, value) => {
            element.textContent = Math.floor(value * 1000).toLocaleString();
        };
        update(this.ips, this.machine.runner.instructions_per_millisecond);
        update(this.tps, this.machine.runner.ticks_per_millisecond);
    }

    /**
     * @param {number} address
     */
    update_video_memory_address(address) {
        $("video_memory_base").textContent = address.toString(16).toUpperCase();
    }

    /**
     * @param {number} width
     * @param {number} height
     */
    update_screen_geometry(width, height) {
        $("screen_width").textContent = width.toString();
        $("screen_height").textContent = height.toString();
    }

    /**
     * @param {string} element
     * @param {boolean} visible
     */
    static visibility(element, visible) {
        $(element).style.display = visible ? "block" : "none";
    }

    /** @param {string} element */
    static hide = (element) => UI.visibility(element, false);

    /** @param {string} element */
    static show = (element) => UI.visibility(element, true);

    /**
     * @param {string} element
     * @returns {boolean}
     */
    static toggleVisibility(element) {
        const visible = UI.isVisible(element);
        UI.visibility(element, !visible);
        return !visible;
    }

    /**
     * @param {string} element
     * @returns {boolean}
     */
    static isVisible(element) {
        const v = $(element).style.display;
        return v !== "none" && v !== "";
    }

    /**
     * @param {string} element
     * @return {boolean}
     */
    static toggleIcon(element) {
        return $(element).classList.toggle("active");
    }

    /**
     * @param {string} element
     * @returns {boolean}
     */
    static isToggleOn = (element) => $(element).classList.contains("active");

    toggle_assembler() {
        const visible = UI.toggleVisibility("assembler_panel");
        UI.toggleIcon("assembler_toggle");

        UI.visibility("canvas", !visible);

        visible ? $("assembler_panel").focus() : $("canvas").focus();
    }

    toggle_disassembler() {
        const visible = UI.toggleVisibility("disassembler_panel");
        UI.toggleIcon("disassembler_toggle");

        if (visible) $("disassembler_panel").focus();

        this.machine.ui.i8080disasm.refresh();
        this.machine.ui.i8080disasm.go_code(this.machine.cpu.pc);
    }

    toggle_terminal() {
        const visible = UI.toggleVisibility("terminal_panel");
        UI.toggleIcon("terminal_toggle");

        // This is the actual terminal object, not the panel.
        if (visible) this.terminal.focus();
    }

    toggle_visualizer() {
        const visible = UI.toggleVisibility("visualizer_panel");
        UI.toggleIcon("visualizer_toggle");

        this.visualizer_visible = visible;
    }

    toggle_keyboard() {
        const visible = UI.toggleVisibility("keyboard_panel");
        UI.toggleIcon("keyboard_toggle");
    }

    computer_snapshot_name = "rk86-snapshot";
    computer_snapshot_count = 1;

    emulator_snapshot() {
        const json = rk86_snapshot(this.machine, "2.0.0");
        const filename = `${this.computer_snapshot_name}-${this.computer_snapshot_count}.json`;
        const blob = new Blob([json], { type: "application/json" });
        saveAs(blob, filename);
        this.computer_snapshot_count += 1;
    }

    configureEventListeners() {
        const machine = this.machine;

        $("ruslat_toggle").addEventListener("click", () => {
            const ruslat_flag = 0x7606;
            const state = this.machine.memory.read(ruslat_flag) ? 0x00 : 0xff;
            this.machine.memory.write(ruslat_flag, state);
            this.update_ruslat(state);
        });

        $("sound_toggle").addEventListener("click", () => {
            const sound_enabled = UI.toggleIcon("sound_toggle");

            this.machine.runner.init_sound(sound_enabled);

            UI.visibility("sound_toggle_icon", sound_enabled);
            UI.visibility("sound_toggle_icon_muted", !sound_enabled);

            const image = $("sound_image");
            image.textContent = /** @type {string} */ (image.dataset[sound_enabled ? "on" : "off"]);

            image.classList.add("visible");
            setTimeout(() => image.classList.remove("visible"), 2000);
        });

        $("catalog_button").addEventListener("click", () => {
            console.log("catalog_button");
            /** @type {HTMLInputElement} */ ($("catalog_selector")).value = "";

            UI.show("catalog_selector");
            UI.hide("selected_file");
            $("catalog_selector").focus();
        });

        $("assembler_toggle").addEventListener("click", () => this.toggle_assembler());
        $("disassembler_toggle").addEventListener("click", () => this.toggle_disassembler());
        $("visualizer_toggle").addEventListener("click", () => this.toggle_visualizer());
        $("terminal_toggle").addEventListener("click", () => this.toggle_terminal());

        moveable($("disassembler_panel"))();
        moveable($("visualizer_panel"))();
        moveable($("terminal_panel"))();
        moveable($("keyboard_panel"))();

        // keyboard dispatcher

        document.onkeydown = (event) => {
            if (this.command_mode) {
                switch (event.code) {
                    case "KeyL":
                        $("catalog_button").click();
                        break;
                    case "KeyU":
                        $("upload_selector").click();
                        break;
                    case "KeyP":
                        pause.click();
                        break;
                    case "KeyG":
                        $("run").click();
                        break;
                    case "KeyK":
                        this.toggle_terminal();
                        break;
                    case "KeyA":
                        this.toggle_assembler();
                        break;
                    case "KeyD":
                        this.toggle_disassembler();
                        break;
                    case "KeyV":
                        this.toggle_visualizer();
                        break;
                    case "KeyS":
                        $("sound_toggle").click();
                        break;
                    case "KeyR":
                        this.restart();
                        break;
                    case "KeyF":
                        this.fullscreen();
                        break;
                    case "KeyW":
                        this.emulator_snapshot();
                        break;
                    case "KeyB":
                        this.toggle_keyboard();
                        break;
                }
                this.command_mode = false;
                $("shortcuts").classList.remove("visible");
                return;
            }

            if (this.meta_press_count > 0) {
                if (event.code === "KeyK") {
                    this.command_mode = true;
                    $("shortcuts").classList.add("visible");
                }
                return;
            }

            if (event.key === "Meta") {
                this.meta_press_count += 1;
                return;
            }

            this.machine.keyboard.onkeydown(event.code);
            return false;
        };

        document.onkeyup = (event) => {
            if (event.key === "Meta") {
                if (this.meta_press_count > 0) this.meta_press_count -= 1;
                return;
            }
            if (this.meta_press_count > 0) return;

            this.machine.keyboard.onkeyup(event.code);
            return false;
        };

        $("disassembler_panel").addEventListener("keyup", (event) => {
            if (event.key === "Escape") {
                $("disassembler_panel").blur();
                this.toggle_disassembler();
            }
            if (event.key === "Enter") {
                this.machine.ui.i8080disasm.form_go_code();
            }
            event.stopPropagation();
        });

        $("disassembler_panel").addEventListener("keydown", (event) => {
            event.stopPropagation();
        });

        $("fullscreen").addEventListener("click", () => {
            this.machine.ui.canvas.requestFullscreen();
        });

        $("pause").addEventListener("click", () => {
            machine.runner.paused = !machine.runner.paused;
            UI.visibility("pause_icon_paused", machine.runner.paused);
            UI.visibility("pause_icon", !machine.runner.paused);
            this.machine.ui.i8080disasm.go_code(machine.cpu.pc);
        });

        // disassembler

        $("disasm_form_code_shift_back_page").addEventListener("click", () => {
            this.machine.ui.i8080disasm.form_code_shift(false, -1);
        });
        $("disasm_form_code_shift_back_one").addEventListener("click", () => {
            this.machine.ui.i8080disasm.form_code_shift(true, -1);
        });
        $("disasm_form_go_code").addEventListener("click", () => {
            this.machine.ui.i8080disasm.form_go_code();
        });
        $("disasm_form_code_shift_forward_one").addEventListener("click", () => {
            this.machine.ui.i8080disasm.form_code_shift(true, 1);
        });
        $("disasm_form_code_shift_forward_page").addEventListener("click", () => {
            this.machine.ui.i8080disasm.form_code_shift(false, 1);
        });

        $("disasm_form_data_shift_back_one").addEventListener("click", () => {
            this.machine.ui.i8080disasm.go_data_shift(-1, { one: true });
        });
        $("disasm_form_data_shift_back_page").addEventListener("click", () => {
            this.machine.ui.i8080disasm.go_data_shift(-1);
        });
        $("disasm_form_go_data").addEventListener("click", () => {
            this.machine.ui.i8080disasm.form_go_data();
        });
        $("disasm_form_data_shift_forward_page").addEventListener("click", () => {
            this.machine.ui.i8080disasm.go_data_shift(1);
        });
        $("disasm_form_data_shift_forward_one").addEventListener("click", () => {
            this.machine.ui.i8080disasm.go_data_shift(1, { one: true });
        });

        const hint = $("hint");

        document.querySelectorAll("button.icon").forEach((element) => {
            const button = /** @type {HTMLButtonElement} */ (element);
            button.addEventListener("mouseover", () => {
                hint.style.opacity = "1";
                hint.textContent = button.dataset.text || "-";
            });
            button.addEventListener("mouseout", () => {
                hint.style.opacity = "0";
                hint.textContent = "";
            });
        });

        $("screenshot").addEventListener("click", () => {
            const filename = this.screenshot_name + "-" + this.screenshot_count + ".png";
            this.screenshot_count += 1;
            this.canvas.toBlob((blob) => saveAs(blob, filename));
        });

        $("memory_snapshot").addEventListener("click", () => {
            const snapshot = new Uint8Array(this.machine.memory.snapshot(0, 0x10000));
            const blob = new Blob([snapshot], { type: "application/octet-stream" });
            const filename = this.memory_snapshot_name + "-" + this.memory_snapshot_count + ".bin";
            saveAs(blob, filename);
            this.memory_snapshot_count += 1;
        });

        $("emulator_snapshot").addEventListener("click", () => this.emulator_snapshot());

        /**
         * @param {string} url
         */
        const openLink = (url) => {
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        $("help").addEventListener("click", () => openLink("help.html"));
        $("keyboard_toggle").addEventListener("click", () => this.toggle_keyboard());
    }

    /**
     * @param {boolean} active
     */
    update_activity_indicator = (active) => {
        UI.visibility("tape_activity_indicator", active);
    };

    /**
     * @param {number} count
     */
    update_written_bytes = (count) => {
        $("tape_written_bytes").textContent = count.toString().padStart(4, "0");
    };

    /**
     * @param {boolean} on
     */
    hightlight_written_bytes = (on) => {
        $("tape_written_bytes").classList.toggle("tape_active", on);
        UI.visibility("tape_data", on);
        UI.visibility("tape_preamble", !on);
    };
}

export async function main() {
    // @ts-ignore
    window.CONSOLE = "console";

    const keyboard = new Keyboard();
    const io = new IO();

    /** @type {{ font: string, keyboard: Keyboard, io: IO, ui: UI }} */
    const machine = {
        font: rk86_font_image(),
        keyboard,
        io,
    };
    machine.memory = new Memory(machine);

    machine.ui = new UI(machine);
    machine.screen = new Screen(machine);
    machine.cpu = new I8080(machine);
    machine.runner = new Runner(machine);

    machine.tape = new Tape(machine);

    /**
     *
     * @param {string} name
     * @returns {Promise<import('./rk86_file_parser.js').File|undefined>} >}
     */
    async function load_catalog_file(name) {
        const content = await fetch_file(name);
        if (!content) return undefined;
        console.log(`загрузка файла [${name}] из каталога размером ${content.length} байт`);
        const file = FileParser.parse_rk86_binary(name, content);
        console.log(
            `загружен файл двоичный РК86`,
            `[${file.name}]`,
            `c адреса ${hex16(file.start)} до ${hex16(file.end)},`,
            `запуск: G${hex16(file.entry)}`
        );
        return file;
    }

    /** @typedef {Object.<number, string>} KeyCodes */
    const KEY_CODES = {
        8: "Backspace",
        9: "Tab",
        13: "Enter",
        16: "ShiftRight",
        17: "ControlLeft",
        32: "Space",
        35: "End",
        36: "Home",
        37: "ArrowLeft",
        38: "ArrowUp",
        39: "ArrowRight",
        40: "ArrowDown",
        46: "Delete",
        48: "Digit0",
        49: "Digit1",
        50: "Digit2",
        51: "Digit3",
        52: "Digit4",
        53: "Digit5",
        54: "Digit6",
        55: "Digit7",
        56: "Digit8",
        57: "Digit9",
        65: "KeyA",
        66: "KeyB",
        67: "KeyC",
        68: "KeyD",
        69: "KeyE",
        70: "KeyF",
        71: "KeyG",
        72: "KeyH",
        73: "KeyI",
        74: "KeyJ",
        75: "KeyK",
        76: "KeyL",
        77: "KeyM",
        78: "KeyN",
        79: "KeyO",
        80: "KeyP",
        81: "KeyQ",
        82: "KeyR",
        83: "KeyS",
        84: "KeyT",
        85: "KeyU",
        86: "KeyV",
        87: "KeyW",
        88: "KeyX",
        89: "KeyY",
        90: "KeyZ",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        121: "F10",
        186: "Semicolon",
        188: "Comma",
        189: "Minus",
        190: "Period",
        192: "Quote",
        191: "Slash",
        219: "BracketLeft",
        221: "BracketRight",
        226: "Backslash",
    };

    /**
     * @param {string|number} key - Either a string keyboard code (like "KeyA") or a numeric key code (like 65)
     * @returns {string} - The keyboard event code (like "KeyA")
     */
    function translate_key(key) {
        if (typeof key === "string") return key;
        return KEY_CODES[key];
    }

    /**
     * @param {Array<{keys: string[], duration: number, action: string}>} sequence
     * @param {number} i
     */
    function execute_commands_loop(sequence, i) {
        const { keyboard } = machine;
        if (i >= sequence.length) return;
        const { keys, duration, action } = sequence[i];
        const call = action === "down" ? keyboard.onkeydown : keyboard.onkeyup;
        if (action != "pause") keys.forEach((key) => call(translate_key(key)));
        setTimeout(() => execute_commands_loop(sequence, i + 1), +duration);
    }

    const execute_commands = (commands) => execute_commands_loop(commands, 0);

    function simulate_keyboard(commands) {
        const queue = convert_keyboard_sequence(commands);
        execute_commands(queue);
    }

    /**
     * @param {string} url
     * @returns {string} - The base name of the URL (the last part after the last slash)
     */
    const basename = (url) => url.split("/").at(-1) || url;

    /**
     * @param {string} name
     * @returns {Promise<number[]|undefined>}
     */
    async function fetch_file(name) {
        const url = filenameURL(name);
        console.log(`скачиваем файл [${url}]`);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`ошибка HTTP: ${response.status}`);
            const content = Array.from(new Uint8Array(await response.arrayBuffer()));
            console.log(`скачен файл [${basename(url)}] длиной ${content.length} байт`);
            return content;
        } catch (error) {
            console.error(`ошибка загрузки файла ${url}: ${error}`);
        }
    }

    /**
     * @param {string} name
     * @returns {string}
     */
    function filenameURL(name) {
        if (name.startsWith("http") || name.startsWith("./")) return name;
        return "files/" + name;
    }

    /**
     * @param {string} name
     * @returns {Promise<void>}
     */
    async function loadAutoexecFile(name) {
        const content = await fetch_file(name);
        if (!content) return;
        parseAndPlaceFile(name, content);
    }

    /** @type {import('./rk86_file_parser.js').File|undefined} */
    let selected_file;

    /**
     * @param {string} name
     * @param {number[]} binary
     * @returns {void}
     */
    function parseAndPlaceFile(name, binary) {
        selected_file = undefined;

        console.log(`размещаем файл [${name}] длиной ${binary.length} в память эмулятора`);
        const json = FileParser.is_json(binary);
        if (json) {
            rk86_snapshot_restore(json, machine, simulate_keyboard);
            console.log(`образ [${name}] загружен, PC=${hex16(json.cpu.pc)}`);
            return;
        }
        try {
            const file = FileParser.parse_rk86_binary(name, binary);
            machine.memory.load_file(file);
            console.log(
                `` +
                    `загружен файл [${name}] ` +
                    `c адреса ${hex16(file.start, "0x")} по ${hex16(file.end, "0x")}, ` +
                    `запуск: G${file.entry.toString(16)}`
            );
            selected_file = file;
        } catch (e) {
            console.error(e);
        }
    }

    const monitor = await load_catalog_file("mon32.bin");
    if (!monitor) {
        alert("Ошибка загрузки монитора mon32.bin");
        return;
    }
    machine.memory.load_file(monitor);

    machine.screen.start();

    const url = window.location.href;

    let match;
    const autoexec_file = (match = url.match(/file=([^&]+)/)) ? match[1] : null;
    const autoexec_loadonly = (match = url.match(/loadonly=([^&]+)/)) ? match[1] : null;

    if (autoexec_file) {
        console.log(`автозагрузка файла: ${autoexec_file}`);
        await loadAutoexecFile(autoexec_file);
    }

    machine.runner.execute();

    function reset() {
        machine.keyboard.reset();
        machine.cpu.jump(0xf800);
    }

    $("reset").addEventListener("click", () => reset());
    $("restart").addEventListener("click", () => {
        machine.memory.zero_ram();
        reset();
    });

    const hideablePanels = [
        "header",
        "footer",
        "disassembler_panel",
        "terminal_panel",
        "visualizer_panel",
        "keyboard_panel",
    ];

    document.addEventListener("fullscreenchange", () => {
        const fullscreen = document.fullscreenElement;
        hideablePanels.forEach((id) => {
            const classList = $(id).classList;
            fullscreen ? classList.add("hidden") : classList.remove("hidden");
        });
    });

    machine.memory.update_ruslat = machine.ui.update_ruslat;

    for (const name of tape_catalog()) {
        const option = document.createElement("option");
        option.value = name;
        $("catalog_files").appendChild(option);
    }

    const catalog_selector = /** @type {HTMLInputElement} */ ($("catalog_selector"));

    catalog_selector.addEventListener("keyup", (event) => {
        if (event.key === "Escape") {
            catalog_selector.value = "";
            selected_file = undefined;
            UI.hide("catalog_selector");
            UI.hide("selected_file");
        }
        if (event.key === "Enter") {
            catalog_selector.blur();
        }
    });

    catalog_selector.addEventListener("keydown", (event) => event.stopPropagation());

    catalog_selector.addEventListener("blur", async (event) => {
        const name = catalog_selector.value.trim();
        if (!name) return;

        await load_catalog_file_from_selector();
        $("selected_file").textContent = selected_file?.name || "";

        UI.hide("catalog_selector");
        UI.visibility("selected_file", selected_file !== undefined);
    });

    catalog_selector.addEventListener("change", (event) => {
        event.stopPropagation();
        $("catalog_selector").blur();
    });

    const upload_selector = /** @type {HTMLInputElement} */ ($("upload_selector"));

    upload_selector.addEventListener("change", async (event) => {
        event.stopPropagation();
        if (!upload_selector.files || upload_selector.files.length === 0) {
            console.warn("нет загруженных файлов");
            return;
        }
        const uploadedFile = upload_selector.files[0];
        console.log(`загружаем внешний файл [${uploadedFile.name}]`);

        const reader = new FileReader();

        reader.onload = async (e) => {
            const data = e.target?.result;
            if (!(data instanceof ArrayBuffer)) {
                console.error("%cошибка: данные не являются ArrayBuffer", "color: red");
                return;
            }
            const binary = Array.from(new Uint8Array(data));
            console.log(`загружен внешний файл [${uploadedFile.name}], размер ${binary.length} байт`);
            try {
                parseAndPlaceFile(uploadedFile.name, binary);
                if (!selected_file) return;

                $("selected_file").textContent = selected_file.name;
                UI.show("selected_file");
            } catch (e) {
                const error = e instanceof Error ? e : new Error("неизвестная ошибка при загрузке файла");
                console.error(`ошибка загрузки файла: ${error.message}`);
                alert(`ошибка загрузки файла: ${error.message}`);
            }
        };
        reader.onerror = () => {
            console.error(`ошибка при загрузке внешнего файла`);
            alert(`ошибка при загрузке внешнего файла`);
        };
        reader.readAsArrayBuffer(uploadedFile);

        upload_selector.value = "";
        catalog_selector.value = uploadedFile.name;
        UI.hide("selected_file");
    });

    /**
     * @returns {Promise<void>}
     */
    async function load_catalog_file_from_selector() {
        const name = catalog_selector.value.trim();
        if (!name) return alert("Hе выбран файл для загрузки.");

        console.log(`файл [${name}] выбран для загрузки`);

        const content = await fetch_file(name);
        if (!content) return;

        parseAndPlaceFile(name, content);
    }

    // $("load").addEventListener("click", async () => {
    //     if (selected_file) return;
    //     await load_catalog_file_from_selector();
    //     if (!selected_file) return;
    //     const { name, start, end, entry } = selected_file;
    //     alert(
    //         [
    //             `загружен файл [${name}]`,
    //             `с адреса ${hex16(start, "0x")} по ${hex16(end, "0x")}`,
    //             `запуск: G${hex16(entry)}`,
    //         ].join("\n")
    //     );
    // });

    $("run").addEventListener("click", async () => {
        if (selected_file) {
            machine.cpu.jump(selected_file.entry);
            return;
        }
        await load_catalog_file_from_selector();
        if (!selected_file) return;
        machine.cpu.jump(selected_file.entry);
    });

    machine.ui.i8080disasm = new I8080DisasmPanel(machine.memory);
    window.i8080disasm = machine.ui.i8080disasm;

    machine.ui.terminal = $("terminal_panel");
    $("terminal_panel").onCommand = (cmd) => {
        console.log(`command received: ${cmd}`);
    };

    machine.ui.start_update_perf();

    window.machine = machine;

    // visualizer
    {
        const content = await (await fetch("./i8080_visualizer.html")).text();
        const loaded = new DOMParser().parseFromString(content, "text/html");

        $("visualizer_panel").innerHTML = loaded.getElementById("visualizer_panel").innerHTML;

        machine.ui.visualizer = new Visualizer();
    }

    // keyboard visualizer
    {
        const content = await (await fetch("./kbd-js.html")).text();
        const loaded = new DOMParser().parseFromString(content, "text/html");

        $("keyboard_panel").innerHTML = loaded.getElementById("keyboard_panel").innerHTML;
        KeyboardVisualizer.create();
    }
}

await main();
