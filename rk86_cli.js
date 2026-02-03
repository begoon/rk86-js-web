import "./format.js";
import { hex16 } from "./hex.js";
import { i8080_opcode } from "./i8080_disasm.js";
import { saveAs } from "./saver.js";

/**
 * @param {string} input
 * @param {number=} default_value
 * @returns {number}
 */
export function parseNumber(input, default_value = undefined) {
    let str = input;
    if (typeof str !== "string" || str.length === 0) return default_value !== undefined ? default_value : NaN;
    str = str.trim();
    if (str.startsWith("$")) str = "0x" + str.slice(1);
    else if (str.startsWith("0x")) str = str;
    else if (str.endsWith("h")) str = "0x" + str.slice(0, -1);
    else if (str.search(/[a-f]/i) >= 0) str = "0x" + str;
    const value = parseInt(str);
    if (isNaN(value) && default_value !== undefined) return default_value;
    return value;
}

/**
 * @class
 */
export default class CLI {
    static from_rk86_table = [
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [" ", "!", '"', "#", "$", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/"],
        ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?"],
        ["@", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"],
        ["P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "[", "\\", "]", "^", "_"],
        ["Ю", "А", "Б", "Ц", "Д", "Е", "Ф", "Г", "Х", "И", "Й", "К", "Л", "М", "Н", "О"],
        ["П", "Я", "Р", "С", "Т", "У", "Ж", "В", "Ь", "Ы", "З", "Ш", "Э", "Щ", "Ч", "~"],
    ].flat();

    constructor(machine) {
        this.machine = machine;

        this.dump_cmd_last_address = 0;
        this.dump_cmd_last_length = 128;

        this.download_cmd_snapshot_address = 0;
        this.download_cmd_snapshot_length = 0x8000;
        this.download_cmd_filename_count = 0;

        this.execute_after_breakpoint = false;

        this.stop_after_next_instruction = -1;
        this.step_over_address = -1;

        this.breaks = {
            1: { type: "exec", address: 0xf86c, active: "no", count: 0, hits: 0 },
            2: { type: "read", address: 0x0100, active: "no", count: 0, hits: 0 },
            3: { type: "write", address: 0x0200, active: "no", count: 0, hits: 0 },
            4: { type: "exec", address: 0xfca5, active: "no", count: 7, hits: 0 },
        };

        /**
         * @type {{[command: string]: [function, string]}}
         */
        this.commands = {
            d: [this.dump_cmd, "dump memory / d [start_address[, number_of_bytes]]"],
            dd: [this.download_cmd, "download memory / dd [start_address=0 [, number_of_bytes=0x8000]]"],
            i: [this.cpu_cmd, "CPU iformation / i"],
            z: [this.disasm_cmd, "disassemble / z [start_address [, number_of_instructions]]"],
            w: [this.write_byte_cmd, "write bytes / w start_address byte1, [byte2, [byte3]...]"],
            ww: [this.write_word_cmd, "write words / ww start_address word1, [word2, [word3]...]"],
            wc: [this.write_char_cmd, "write characters / ww start_address string"],
            t: [this.debug_cmd, "debug control / t [on|off]"],
            p: [this.pause_cmd, "pause CPU / p"],
            r: [this.resume_cmd, "resume CPU / r"],
            g: [this.go_cmd, "go to an address / g 0xf86c"],
            gr: [this.reset_cmd, "reset / gr"],
            gs: [this.restart_cmd, "restart / gs"],
            s: [this.single_step_cmd, "single step"],
            so: [this.step_over_cmd, "step over"],
            bl: [this.list_breakpoints_cmd, "list breakpoints / bl"],
            be: [this.edit_breakpoints_cmd, "create/edit breakpoints / be 1 type:exec address:0xf86c count:3"],
            bd: [this.delete_breakpoints_cmd, "delete breakpoints / bd 1"],
            cs: [this.check_sum_cmd, "calculate checksum / cs start_address, end_address"],
            h: [this.history_cmd, "предыдущие команды / h"],
            "?": [this.help_cmd, "this help / ?"],
        };
    }

    help_cmd(args) {
        const commands = this.commands;
        for (let cmd of Object.keys(commands)) {
            const [handler, description] = commands[cmd];
            this.put("%s - %s\n".format(cmd.padEnd(2, " "), description));
        }
    }

    dump_cmd(args) {
        let from = parseNumber(args[0], this.dump_cmd_last_address);
        let sz = parseNumber(args[1], this.dump_cmd_last_length);

        this.dump_cmd_last_length = sz;

        const { memory } = this.machine;

        const WIDTH = 16;
        while (sz > 0) {
            let bytes = "";
            let chars = "";
            const chunk_sz = Math.min(WIDTH, sz);
            for (let i = 0; i < chunk_sz; ++i) {
                const byte = memory.read_raw(from + i);
                bytes += "%02X ".format(byte);
                chars += byte >= 32 && byte < 127 ? CLI.from_rk86_table[byte] : ".";
            }
            if (sz < WIDTH) {
                bytes += " ".repeat((WIDTH - sz) * 3);
                chars += " ".repeat(WIDTH - sz);
            }
            this.put("%04X: %s | %s\n".format(from, bytes, chars).replace(/ /g, "&nbsp;"));
            sz -= chunk_sz;
            from = (from + chunk_sz) & 0xffff;
        }
        this.dump_cmd_last_address = from;
    }

    download_cmd(args) {
        this.download_cmd_snapshot_address = parseNumber(args[0], this.download_cmd_snapshot_address);
        this.download_cmd_snapshot_length = parseNumber(args[1], this.download_cmd_snapshot_length);

        this.download_cmd_filename_count += 1;
        const filename = "rk86-memory-%04X-%04X-%d.bin".format(
            this.download_cmd_snapshot_address,
            this.download_cmd_snapshot_length,
            this.download_cmd_filename_count,
        );

        console.log(
            `download ${hex16(this.download_cmd_snapshot_address)}:${hex16(
                this.download_cmd_snapshot_length,
            )} -> ${filename}`,
        );

        const { memory } = this.machine;
        const content = memory.snapshot(this.download_cmd_snapshot_address, this.download_cmd_snapshot_address);
        const blob = new Blob([new Uint8Array(content)], { type: "application/octet-stream" });

        saveAs(blob, filename);
    }

    /**
     * @param {number} address
     * @param {number} nb_instr
     * @param {number} current_addr
     * @returns {number}
     */
    disasm_print(address, nb_instr, current_addr) {
        let addr = address;
        let n = nb_instr;
        const { memory } = this.machine;
        while (n-- > 0) {
            let binary = [];
            for (let i = 0; i < 3; ++i) binary.push(memory.read_raw(addr + i));
            const instr = i8080_opcode(...binary);

            let bytes = "";
            let chars = "";
            for (let i = 0; i < instr.length; ++i) {
                const byte = binary[i];
                bytes += "%02X".format(byte);
                chars += byte >= 32 && byte < 127 ? CLI.from_rk86_table[byte] : ".";
            }
            bytes += "&nbsp;".repeat((binary.length - instr.length) * 2);
            chars += "&nbsp;".repeat(binary.length - instr.length);

            const current = current_addr && addr == current_addr ? ">" : " ";
            this.put("%04X: %s%s %s %s\n".format(addr, current, bytes, chars, instr.instr));
            addr += instr.length;
        }
        return addr;
    }

    cpu_cmd(args) {
        const { cpu, runner, memory } = this.machine;
        this.term.write(
            "PC=%04X A=%02X F=%s%s%s%s%s HL=%04X DE=%04X BC=%04X SP=%04X".format(
                cpu.pc,
                cpu.a(),
                cpu.cf ? "C" : "-",
                cpu.pf ? "P" : "-",
                cpu.hf ? "H" : "-",
                cpu.zf ? "Z" : "-",
                cpu.sf ? "S" : "-",
                cpu.hl(),
                cpu.de(),
                cpu.bc(),
                cpu.sp,
            ),
        );
        this.term.writeln("");

        const { last_instructions } = runner;
        for (let i = 0; i < last_instructions.length; ++i) {
            const addr = last_instructions[i];
            this.disasm_print(addr, 1, cpu.pc);
        }
        this.disasm_print(cpu.pc, 5, cpu.pc);

        const hex = (addr, title) => {
            let bytes = "";
            let chars = "";
            for (let i = 0; i < 16; ++i) {
                const byte = memory.read_raw(addr + i);
                bytes += "%02X ".format(byte);
                chars += byte >= 32 && byte < 127 ? from_rk86_table[byte] : ".";
            }
            this.term.writeln("%s=%04X: %s | %s".format(title, addr, bytes, chars));
        };

        hex(cpu.pc, "PC");
        hex(cpu.sp, "SP");
        hex(cpu.hl(), "HL");
        hex(cpu.de(), "DE");
        hex(cpu.bc(), "BC");
    }

    disasm_cmd(args) {
        const { cpu } = this.machine;

        let from = parseNumber(args[0]);
        if (isNaN(from)) from = this.disasm_cmd_last_address || cpu.pc;

        let sz = parseNumber(args[1]);
        if (isNaN(sz)) sz = this.disasm_cmd_last_length || 16;
        this.disasm_cmd_last_length = sz;

        this.disasm_cmd_last_address = this.disasm_print(from, sz);
    }

    write_byte_cmd(args) {
        if (args.length < 2) {
            this.term.write("?");
            return;
        }

        let addr = parseNumber(args.shift(), 0);

        const { memory } = this.machine;

        for (let i = 0; i < args.length; ++i) {
            const byte = parseNumber(args[i]);
            if (isNaN(byte)) break;
            this.term.writeln("%04X: %02X -> %02X".format(addr, memory.read_raw(addr), byte));
            memory.write_raw(addr, byte);
            addr = (addr + 1) & 0xffff;
        }
    }

    write_word_cmd(args) {
        if (args.length < 2) {
            this.term.write("?");
            return;
        }

        const { memory } = this.machine;

        let addr = parseNumber(args.shift(), 0);

        for (let i = 0; i < args.length; ++i) {
            const w16 = parseNumber(args[i]);
            if (isNaN(w16)) break;

            const l = w16 & 0xff;
            const h = w16 >> 8;

            this.term.writeln("%04X: %02X -> %02X".format(addr, memory.read_raw(addr), l));
            memory.write_raw(addr, l);
            addr = (addr + 1) & 0xffff;

            tthis.erm.writeln("%04X: %02X -> %02X".format(addr, memory.read_raw(addr), h));
            memory.write_raw(addr, h);
            addr = (addr + 1) & 0xffff;
        }
    }

    write_char_cmd(args) {
        if (args.length < 2) {
            this.term.write("?");
            return;
        }

        const { memory } = this.machine;

        let addr = parseNumber(args.shift(), 0);

        const str = args[0];
        if (!str?.length == 0) return;

        for (let i = 0; i < s.length; ++i) {
            const ch = str.charCodeAt(i) & 0xff;

            this.term.writeln("%04X: %02X -> %02X".format(addr, memory.read_raw(addr), ch));
            memory.write_raw(addr, ch);
            addr = (addr + 1) & 0xffff;
        }
    }

    print_breakpoint(n, b) {
        const active = b.active == "yes" ? "active" : "disabled";
        self.term.write("Breakpoint #%s %s %s %04X".format(n, b.type, active, b.address));
        if (b.count) this.term.write(" count:%d/%d".format(b.count, b.hits));
        this.term.writeln("");
    }

    process_breakpoint(i, b) {
        this.print_breakpoint(i, b);
        this.pause_cmd();
        this.term.prompt();
        window.focus();
        this.execute_after_breakpoint = true;
    }

    tracer_callback(cpu, when) {
        // After entering into the single step mode ('s' command) we have to
        // execute one instruction (because CPU commands are executed AFTER
        // processing console commands) and then stop before the next one.
        // So the 's' command sets "stop_after_next_instruction" to 0, we
        // catch that in this callback, execute and current command, then set
        // "stop_after_next_instruction" to 1 and then use this as the
        // condition to stop before the next instruction.
        if (this.stop_after_next_instruction == 1) {
            this.pause_cmd(this);
            this.term.prompt();
            this.stop_after_next_instruction = -1;
            return;
        }

        if (this.stop_after_next_instruction == 0) this.stop_after_next_instruction = 1;

        // After hitting a breakpoint, we have to forcibly execute the current
        // instruction. Otherwise it will hit the same breakpoint immediatelly
        // and execution will be stuck.
        if (this.execute_after_breakpoint) {
            this.execute_after_breakpoint = false;
            return false;
        }

        const breakpoint_hit = (breakpoint, breakpoint_index) => {
            if (!b.count) this.this.process_breakpoint(breakpoint_index, breakpoint);
            else {
                ++b.hits;
                if (b.hits == b.count) {
                    this.process_breakpoint(breakpoint_index, breakpoint);
                    b.hits = 0;
                }
            }
            if (b.temporary == "yes") breaks[i] = null;
        };

        for (let i in breaks) {
            const b = breaks[i];
            if (b == null || b.active != "yes") continue;
            // Process "exec" breakpoints only before the current instruction.
            if (when == "before" && b.address == cpu.pc && b.type == "exec") {
                this.breakpoint_hit(b, i);
            }
            // Process "read/write" breakpoints only after the current instruction.
            if (when == "after") {
                const address = cpu.memory.last_access_address;
                const operation = cpu.memory.last_access_operation;
                if (b.address == address && b.type == operation) {
                    this.breakpoint_hit(b, i);
                }
            }
        }
    }

    debug_cmd(args) {
        const state = args[0];
        const { runner } = this.machine;

        if (state == "on" || state == "off") {
            if (state == "on") {
                this.term.writeln("Tracing is on");
                runner.tracer = (when) => {
                    const { cpu } = this.machine.runner;
                    return tracer_callback(self, cpu, when);
                };
            } else {
                runner.tracer = null;
                this.term.write("Tracing is off");
            }
        } else {
            this.term.write("Trace is %s".format(runner.tracer ? "on" : "off"));
        }
    }

    check_tracer_active(args) {
        if (this.machine.runner.tracer == null) {
            this.term.writeln("Tracing is not active. Use 't' command to activate.");
            return false;
        }
        return true;
    }

    list_breakpoints_cmd(args) {
        for (let i in breaks) {
            const b = breaks[i];
            if (b == null) continue;
            this.print_breakpoint(i, b);
        }
    }

    edit_breakpoints_cmd(args) {
        if (this.term.argc < 3) {
            this.term.write("?");
            return;
        }
        var n = parseInt(term.argv[1]);
        if (isNaN(n)) {
            this.term.write("?");
            return;
        }
        if (breaks[n] == null) breaks[n] = { type: "?", active: "no", address: 0 };
        var b = breaks[n];

        for (var i = 2; i < this.term.argc; ++i) {
            var args = this.term.argv[i].split(/[:=]/);
            var arg = args.shift();
            var value = args.shift();
            if (["count", "address", "hits"].indexOf(arg) != -1) {
                const num = parseInt(value);
                if (isNaN(num)) {
                    this.term.write("?");
                    return;
                }
                b[arg] = num;
                if (arg == "count") b.hits = 0;
            } else b[arg] = value;
        }
    }

    delete_breakpoints_cmd(args) {
        var term = term;

        if (term.argc < 2) {
            this.term.write("?");
            return;
        }
        var n = parseInt(term.argv[1]);
        if (isNaN(n)) {
            this.term.write("?");
            return;
        }

        breaks[n] = null;
    }

    pause_cmd(args) {
        runner.pause();
        pause();
        ui.update_pause_button(runner.paused);
    }

    resume_cmd(args) {
        runner.resume();
        resume();
        ui.update_pause_button(runner.paused);
        window.opener.focus();
    }

    reset_cmd(args) {
        ui.reset();
        window.opener.focus();
    }

    restart_cmd(args) {
        ui.restart();
        window.opener.focus();
    }

    go_cmd(args) {
        if (term.argc < 2) {
            this.term.write("?");
            return;
        }
        var addr = parseInt(term.argv[1]);
        if (isNaN(addr)) {
            this.term.write("?");
            return;
        }
        runner.cpu.jump(addr);
    }

    single_step_cmd(args) {
        if (!check_tracer_active(self)) return;
        stop_after_next_instruction = 0;
        resume_cmd(self);
    }

    step_over_cmd(args) {
        var cpu = runner.cpu;
        var mem = cpu.memory;
        var binary = [];
        for (var i = 0; i < 3; ++i) binary[binary.length] = mem.read_raw(cpu.pc + i);
        var instr = i8080_disasm(binary);
        var b = {
            type: "exec",
            address: (cpu.pc + instr.length) & 0xffff,
            active: "yes",
            temporary: "yes",
        };
        breaks[1000] = b;
        resume_cmd(self);
    }

    check_sum_cmd(args) {
        if (term.argc < 3) {
            this.term.write("?");
            return;
        }
        var from = parseInt(term.argv[1]);
        if (isNaN(from)) {
            this.term.write("?");
            return;
        }
        var to = parseInt(term.argv[2]);
        if (isNaN(to)) {
            this.term.write("?");
            return;
        }
        const image = runner.cpu.memory.snapshot(from, to + 1 - from);
        const checksum = rk86_check_sum(image);
        this.term.writeln("%04X-%04X: %04X".format(from, to, checksum));
    }

    history_cmd(args) {
        const limit = 10;
        if (this.history.length === 0) return;
        const from = Math.max(0, this.history.length - limit);
        this.history.slice(from).forEach((cmd, index) => {
            this.term.writeln("%d: %s".format(from + index + 1, cmd));
        });
        this.term.writeln("\nКлавиши вверх/вниз для навигации по истории команд.");
    }

    /** @param {string} str */
    put(str) {
        this.machine.ui.terminal.put(str);
    }

    /** @param {string} cmd */
    run(cmd) {
        let line = cmd.trim();
        if (line.length == 0) return;

        const argv = line.split(/\s+/);
        const argc = argv.length;

        this.put("\n");

        if (argv.length > 0) {
            const cmd = argv[0];
            const args = argv.slice(1);
            const [handler, description] = this.commands[cmd.toLowerCase()];
            console.log(description, args);
            if (handler) handler.call(this, args);
            else this.put("?");
        }
    }

    pause() {
        this.term.writeln("Paused at %04X".format(runner.cpu.pc));
        this.cpu_cmd(this);
    }

    pause_ui_callback() {
        this.pause();
        this.term.prompt();
    }

    resume() {
        this.term.write("Resumed");
    }

    resume_ui_callback() {
        this.resume();
        this.term.prompt();
    }
}
