import { I8080 } from "$lib/i8080";
import { Keyboard } from "$lib/rk86_keyboard";
import { tape_catalog } from "$lib/tape_catalog";
import { hex16 } from "../lib/hex.js";
import type { RK86File } from "../lib/rk86_file_parser.js";
import * as FileParser from "../lib/rk86_file_parser.js";
import { rk86_font_image } from "../lib/rk86_font.js";
import type { SequenceAction } from "../lib/rk86_keyboard_injector.js";
import { convert_keyboard_sequence } from "../lib/rk86_keyboard_injector.js";
import type { Machine, MachineBuilder } from "../lib/rk86_machine.js";
import { Memory } from "../lib/rk86_memory.js";
import { Runner } from "../lib/rk86_runner.js";
import { Screen } from "../lib/rk86_screen.js";
import { rk86_snapshot, rk86_snapshot_restore } from "../lib/rk86_snapshot.js";
import { Tape } from "../lib/rk86_tape.js";
import { saveAs } from "../lib/saver.js";
import { ui } from "./ui_state.svelte";
const elements = new Map();

// ---

class IO {
    input = (port: number): number => 0;
    output = (port: number, w8: number): void => {};
    interrupt = (iff: number): void => {};
}

export class UI {
    machine: Machine;
    canvas: HTMLCanvasElement;
    ips!: HTMLElement;
    tps!: HTMLElement;
    meta_press_count = 0;
    command_mode = false;
    screenshot_name = "rk86-screen";
    screenshot_count = 1;
    memory_snapshot_name = "rk86-memory";
    memory_snapshot_count = 1;
    terminal: any;
    i8080disasm: any;
    visualizer: any;
    visualizer_visible = false;

    constructor(machine: Machine, canvas: HTMLCanvasElement) {
        this.machine = machine;
        this.canvas = canvas;

        // this.canvas = $("canvas") as HTMLCanvasElement;
        if (!this.canvas || !this.canvas.getContext) {
            console.log("Tag <canvas> is not supported in the browser");
            return;
        }

        // this.ips = $("ips");
        // this.tps = $("tps");

        // this.configureEventListeners();
    }

    start_update_perf = () => setInterval(() => this.update_perf(), 2000);

    resize_canvas(width: number, height: number): void {
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

    update_ruslat = (value: boolean): void => {
        ui.rusLat = value;
    };

    update_perf() {
        ui.ips = this.machine.runner.instructions_per_millisecond;
        ui.tps = this.machine.runner.ticks_per_millisecond;
    }

    update_video_memory_address(address: number): void {
        ui.videoMemoryBase = address;
    }

    update_screen_geometry(width: number, height: number): void {
        ui.screenWidth = width;
        ui.screenHeight = height;
    }

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

    screenshot() {
        const filename = `${this.screenshot_name}-${this.screenshot_count}.png`;
        this.screenshot_count += 1;
        this.canvas.toBlob((blob: Blob | null) => blob && saveAs(blob, filename));
    }

    memory_snapshot() {
        const snapshot = new Uint8Array(this.machine.memory.snapshot(0, 0x10000));
        const blob = new Blob([snapshot], { type: "application/octet-stream" });
        const filename = `${this.memory_snapshot_name}-${this.memory_snapshot_count}.bin`;
        saveAs(blob, filename);
        this.memory_snapshot_count += 1;
    }

    // configureEventListeners() {
    //     const machine = this.machine;

    //     $("catalog_button").addEventListener("click", () => {
    //         console.log("catalog_button");
    //         ($("catalog_selector") as HTMLInputElement).value = "";

    //         UI.show("catalog_selector");
    //         UI.hide("selected_file");
    //         $("catalog_selector").focus();
    //     });

    //     $("assembler_toggle").addEventListener("click", () => this.toggle_assembler());
    //     $("disassembler_toggle").addEventListener("click", () => this.toggle_disassembler());
    //     $("visualizer_toggle").addEventListener("click", () => this.toggle_visualizer());
    //     $("terminal_toggle").addEventListener("click", () => this.toggle_terminal());

    //     moveable($("disassembler_panel"))();
    //     moveable($("visualizer_panel"))();
    //     moveable($("terminal_panel"), "input")();
    //     moveable($("keyboard_panel"))();

    //     // keyboard dispatcher

    //     document.onkeydown = (event) => {
    //         if (this.command_mode) {
    //             event.preventDefault();
    //             switch (event.code) {
    //                 case "KeyL":
    //                     $("catalog_button").click();
    //                     break;
    //                 case "KeyU":
    //                     $("upload_selector").click();
    //                     break;
    //                 case "KeyP":
    //                     $("pause").click();
    //                     break;
    //                 case "KeyG":
    //                     $("run").click();
    //                     break;
    //                 case "KeyK":
    //                     this.toggle_terminal();
    //                     break;
    //                 case "KeyA":
    //                     this.toggle_assembler();
    //                     break;
    //                 case "KeyD":
    //                     this.toggle_disassembler();
    //                     break;
    //                 case "KeyV":
    //                     this.toggle_visualizer();
    //                     break;
    //                 case "KeyS":
    //                     $("sound_toggle").click();
    //                     break;
    //                 case "KeyR":
    //                     this.restart();
    //                     break;
    //                 case "KeyF":
    //                     this.fullscreen();
    //                     break;
    //                 case "KeyW":
    //                     this.emulator_snapshot();
    //                     break;
    //                 case "KeyB":
    //                     this.toggle_keyboard();
    //                     break;
    //             }
    //             this.command_mode = false;
    //             $("shortcuts").classList.remove("visible");
    //             return;
    //         }

    //         if (this.meta_press_count > 0) {
    //             if (event.code === "KeyK") {
    //                 this.command_mode = true;
    //                 $("shortcuts").classList.add("visible");
    //             }
    //             return;
    //         }

    //         if (event.key === "Meta") {
    //             this.meta_press_count += 1;
    //             return;
    //         }

    //         this.machine.keyboard.onkeydown(event.code);
    //         return false;
    //     };

    //     document.onkeyup = (event) => {
    //         if (event.key === "Meta") {
    //             if (this.meta_press_count > 0) this.meta_press_count -= 1;
    //             return;
    //         }
    //         if (this.meta_press_count > 0) return;

    //         this.machine.keyboard.onkeyup(event.code);
    //         return false;
    //     };

    //     $("disassembler_panel").addEventListener("keyup", (event) => {
    //         if (event.key === "Escape") {
    //             $("disassembler_panel").blur();
    //             this.toggle_disassembler();
    //         }
    //         if (event.key === "Enter") {
    //             this.machine.ui.i8080disasm.form_go_code();
    //         }
    //         event.stopPropagation();
    //     });

    //     $("disassembler_panel").addEventListener("keydown", (event) => {
    //         event.stopPropagation();
    //     });

    //     $("fullscreen").addEventListener("click", () => {
    //         this.machine.ui.canvas.requestFullscreen();
    //     });

    //     $("pause").addEventListener("click", () => {
    //         machine.runner.paused = !machine.runner.paused;
    //         UI.visibility("pause_icon_paused", machine.runner.paused);
    //         UI.visibility("pause_icon", !machine.runner.paused);
    //         this.machine.ui.i8080disasm.go_code(machine.cpu.pc);
    //     });

    //     // disassembler

    //     $("disasm_form_code_shift_back_page").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.form_code_shift(false, -1);
    //     });
    //     $("disasm_form_code_shift_back_one").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.form_code_shift(true, -1);
    //     });
    //     $("disasm_form_go_code").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.form_go_code();
    //     });
    //     $("disasm_form_code_shift_forward_one").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.form_code_shift(true, 1);
    //     });
    //     $("disasm_form_code_shift_forward_page").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.form_code_shift(false, 1);
    //     });

    //     $("disasm_form_data_shift_back_one").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.go_data_shift(-1, { one: true });
    //     });
    //     $("disasm_form_data_shift_back_page").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.go_data_shift(-1);
    //     });
    //     $("disasm_form_go_data").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.form_go_data();
    //     });
    //     $("disasm_form_data_shift_forward_page").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.go_data_shift(1);
    //     });
    //     $("disasm_form_data_shift_forward_one").addEventListener("click", () => {
    //         this.machine.ui.i8080disasm.go_data_shift(1, { one: true });
    //     });

    // }

    update_activity_indicator = (active: boolean): void => {
        ui.tapeActivityActive = active;
    };

    update_written_bytes = (count: number): void => {
        ui.tapeWrittenBytes = count;
    };

    hightlight_written_bytes = (on: boolean): void => {
        ui.tapeHighlight = on;
    };
}

export async function main(canvas: HTMLCanvasElement) {
    // @ts-ignore
    // window.CONSOLE = "console";

    const keyboard = new Keyboard();
    const io = new IO();

    const machineBuilder: MachineBuilder = {
        font: rk86_font_image(),
        keyboard,
        io,
    };
    const machine = machineBuilder as Machine;

    machine.ui = new UI(machine, canvas);
    machine.ui.canvas = canvas;

    machine.memory = new Memory(machine);
    console.log("память инициализирована");

    machine.cpu = new I8080(machine);
    console.log("процессор инициализирован");

    machine.screen = new Screen(machine);
    console.log("экран инициализирован");

    machine.tape = new Tape(machine);
    console.log("магнитофон инициализирован");

    machine.runner = new Runner(machine);
    console.log("исполнитель инициализирован");

    async function load_catalog_file(name: string): Promise<RK86File | undefined> {
        const content = await fetch_file(name);
        if (!content) return undefined;
        console.log(`загрузка файла [${name}] из каталога размером ${content.length} байт`);
        const file = FileParser.parse_rk86_binary(name, content);
        console.log(
            `загружен файл двоичный РК86`,
            `[${file.name}]`,
            `c адреса ${hex16(file.start)} до ${hex16(file.end)},`,
            `запуск: G${hex16(file.entry)}`,
        );
        return file;
    }

    const KEY_CODES: Record<number, string> = {
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

    function translate_key(key: string | number): string {
        if (typeof key === "string") return key;
        return KEY_CODES[key];
    }

    function command_injector(sequence: SequenceAction[], i: number): void {
        if (i >= sequence.length) return;
        const { keyboard } = machineBuilder;
        const { keys, duration, action } = sequence[i];
        const call = action === "down" ? keyboard.onkeydown : keyboard.onkeyup;
        if (action != "pause") {
            if (Array.isArray(keys)) {
                keys.forEach((key) => call(translate_key(key)));
            } else {
                call(translate_key(keys));
            }
        }
        setTimeout(() => command_injector(sequence, i + 1), +duration);
    }

    const execute_commands = (commands: SequenceAction[]): void => command_injector(commands, 0);

    function simulate_keyboard(commands: SequenceAction[]): void {
        const queue = convert_keyboard_sequence(commands);
        execute_commands(queue);
    }

    const basename = (url: string): string => url.split("/").at(-1) || url;

    async function fetch_file(name: string): Promise<number[] | undefined> {
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

    function filenameURL(name: string): string {
        if (name.startsWith("http") || name.startsWith("$lib/")) return name;
        return "files/" + name;
    }

    async function loadAutoexecFile(name: string): Promise<void> {
        const content = await fetch_file(name);
        if (!content) return;
        parseAndPlaceFile(name, content);
    }

    let selected_file: RK86File | undefined;

    function parseAndPlaceFile(name: string, binary: number[]): void {
        selected_file = undefined;
        ui.selectedFileName = "";

        console.log(`размещаем файл [${name}] длиной ${binary.length} в память эмулятора`);
        const { ok, json } = FileParser.parse(binary);
        if (ok) {
            rk86_snapshot_restore(json, machine, simulate_keyboard);
            console.log(`образ [${name}] загружен, PC=${hex16(json.cpu.pc)}`);
            ui.selectedFileName = name;
            return;
        }
        try {
            const file = FileParser.parse_rk86_binary(name, binary);
            machine.memory.load_file(file);
            console.log(
                `` +
                    `загружен файл [${name}] ` +
                    `c адреса ${hex16(file.start, "0x")} по ${hex16(file.end, "0x")}, ` +
                    `запуск: G${file.entry.toString(16)}`,
            );
            selected_file = file;
            ui.selectedFileName = file.name;
            ui.selectedFileStart = file.start;
            ui.selectedFileEnd = file.end;
            ui.selectedFileSize = file.end - file.start;
            ui.selectedFileEntry = file.entry;
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
    console.log("монитор загружен в память");

    machine.screen.start();
    console.log("экран запущен");

    const url = window.location.href;

    let match;
    const auto_run = (match = url.match(/(file|run)=([^&]+)/)) ? match[2] : null;
    const auto_load = (match = url.match(/load=([^&]+)/)) ? match[1] : null;

    if (auto_run) {
        console.log(`автозагрузка и запуск файла ${auto_run}`);
        await loadAutoexecFile(auto_run);
    } else if (auto_load) {
        console.log(`автозагрузка файла (без запуска) ${auto_load}`);
        await loadAutoexecFile(auto_load);
    }

    machine.runner.execute();

    if (auto_run && selected_file) {
        setTimeout(() => machine.cpu.jump(selected_file!.entry), 500);
    }

    function reset() {
        machine.keyboard.reset();
        machine.cpu.jump(0xf800);
    }

    function restart() {
        machine.memory.zero_ram();
        reset();
    }

    function pause(value: boolean) {
        machine.runner.paused = value;
        machine.ui.on_pause_changed?.(value);
    }

    machine.reset = reset;
    machine.restart = restart;
    machine.pause = pause;

    machine.loadCatalogFile = async (name: string) => {
        const content = await fetch_file(name);
        if (!content) return;
        parseAndPlaceFile(name, content);
    };

    machine.runLoadedFile = () => {
        if (selected_file) machine.cpu.jump(selected_file.entry);
    };

    machine.uploadFile = async (file: File) => {
        const data = await file.arrayBuffer();
        const binary = Array.from(new Uint8Array(data));
        console.log(`загружен внешний файл [${file.name}], размер ${binary.length} байт`);
        parseAndPlaceFile(file.name, binary);
    };

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

    machineBuilder.memory.update_ruslat = machineBuilder.ui.update_ruslat;

    for (const name of tape_catalog()) {
        const option = document.createElement("option");
        option.value = name;
        // $("catalog_files").appendChild(option);
    }

    // const catalog_selector = $("catalog_selector") as HTMLInputElement;

    // catalog_selector.addEventListener("keyup", (event) => {
    //     if (event.key === "Escape") {
    //         catalog_selector.value = "";
    //         selected_file = undefined;
    //         UI.hide("catalog_selector");
    //         UI.hide("selected_file");
    //     }
    //     if (event.key === "Enter") {
    //         catalog_selector.blur();
    //     }
    // });

    // catalog_selector.addEventListener("keydown", (event) => event.stopPropagation());

    // catalog_selector.addEventListener("blur", async (event) => {
    //     const name = catalog_selector.value.trim();
    //     if (!name) return;

    //     await load_catalog_file_from_selector();
    //     $("selected_file").textContent = selected_file?.name || "";

    //     UI.hide("catalog_selector");
    //     UI.visibility("selected_file", selected_file !== undefined);
    // });

    // catalog_selector.addEventListener("change", (event) => {
    //     event.stopPropagation();
    //     $("catalog_selector").blur();
    // });

    // const upload_selector = $("upload_selector") as HTMLInputElement;

    // upload_selector.addEventListener("change", async (event) => {
    //     event.stopPropagation();
    //     if (!upload_selector.files || upload_selector.files.length === 0) {
    //         console.warn("нет загруженных файлов");
    //         return;
    //     }
    //     const uploadedFile = upload_selector.files[0];
    //     console.log(`загружаем внешний файл [${uploadedFile.name}]`);

    //     const reader = new FileReader();

    //     reader.onload = async (e) => {
    //         const data = e.target?.result;
    //         if (!(data instanceof ArrayBuffer)) {
    //             console.error("%cошибка: данные не являются ArrayBuffer", "color: red");
    //             return;
    //         }
    //         const binary = Array.from(new Uint8Array(data));
    //         console.log(`загружен внешний файл [${uploadedFile.name}], размер ${binary.length} байт`);
    //         try {
    //             parseAndPlaceFile(uploadedFile.name, binary);
    //             if (!selected_file) return;

    //             $("selected_file").textContent = selected_file.name;
    //             UI.show("selected_file");
    //         } catch (e) {
    //             const error = e instanceof Error ? e : new Error("неизвестная ошибка при загрузке файла");
    //             console.error(`ошибка загрузки файла: ${error.message}`);
    //             alert(`ошибка загрузки файла: ${error.message}`);
    //         }
    //     };
    //     reader.onerror = () => {
    //         console.error(`ошибка при загрузке внешнего файла`);
    //         alert(`ошибка при загрузке внешнего файла`);
    //     };
    //     reader.readAsArrayBuffer(uploadedFile);

    //     upload_selector.value = "";
    //     catalog_selector.value = uploadedFile.name;
    //     UI.hide("selected_file");
    // });

    async function load_catalog_file_from_selector(): Promise<void> {
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

    // $("run").addEventListener("click", async () => {
    //     if (selected_file) {
    //         machineBuilder.cpu.jump(selected_file.entry);
    //         return;
    //     }
    //     await load_catalog_file_from_selector();
    //     if (!selected_file) return;
    //     machineBuilder.cpu.jump(selected_file.entry);
    // });

    // machineBuilder.ui.i8080disasm = new I8080DisasmPanel(machineBuilder.memory);
    // window.i8080disasm = machineBuilder.ui.i8080disasm;

    // machineBuilder.cli = new CLI(machineBuilder);

    // machineBuilder.ui.terminal = $("terminal_panel");
    // $("terminal_panel").run = (cmd) => {
    //     console.log(`команда: ${cmd}`);
    //     machineBuilder.cli.run(cmd);
    // };
    // $("terminal_panel").put("консоль подключена");

    machineBuilder.ui!.start_update_perf();

    // window.machine = machineBuilder;

    // // visualizer
    // {
    //     const content = await (await fetch("$lib/i8080_visualizer.html")).text();
    //     const loaded = new DOMParser().parseFromString(content, "text/html");

    //     $("visualizer_panel").innerHTML = loaded.getElementById("visualizer_panel").innerHTML;

    //     machineBuilder.ui.visualizer = new Visualizer();
    // }

    // // keyboard visualizer
    // {
    //     const content = await (await fetch("$lib/kbd-js.html")).text();
    //     const loaded = new DOMParser().parseFromString(content, "text/html");

    //     $("keyboard_panel").innerHTML = loaded.getElementById("keyboard_panel").innerHTML;
    //     KeyboardVisualizer.create();
    // }
    return machine;
}
