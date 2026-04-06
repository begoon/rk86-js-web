import { i8080_opcode } from "./i8080_disasm.ts";

const DATA_WIDTH = 8;

const hex = (v: number): string => v.toString(16).toUpperCase();
const hex8 = (v: number): string => hex(v).padStart(2, "0");
const hex16 = (v: number): string => hex(v).padStart(4, "0");

class I8080DisasmPanel {
    memory: any;

    constructor(memory: any) {
        this.memory = memory;
    }

    wrap(addr: number): number {
        return (addr + this.memory.length()) % this.memory.length();
    }

    disasm(addr: number): any {
        const opcode = this.memory.read(addr);
        const byte2 = this.memory.read(addr + 1);
        const byte3 = this.memory.read(addr + 2);
        return i8080_opcode(opcode, byte2, byte3);
    }

    renderCode(address: number, lines: number): string {
        let addr = address;

        const output = [];
        for (let i = 0; i < lines; i++) {
            const instr = this.disasm(addr);

            let line = hex16(addr) + ": ";

            let chars = "";
            for (let j = 0; j < instr.length; ++j) {
                const ch = this.memory.read(addr + j);
                line += hex8(ch);
                chars += String.fromCharCode(ch < 32 || ch > 127 ? 0x2e : ch);
            }
            chars += "&nbsp;".repeat(3 - instr.length);
            chars = chars.replace(" ", "&nbsp;");
            line += "&nbsp;".repeat((3 - instr.length) * 2) + " " + chars + " ";

            const color = instr.bad ? "red" : "white";
            line += `<span style='color: ${color};'>${instr.cmd}</span>`;
            line += "&nbsp;".repeat(5 - instr.cmd.length);

            const format_argument = (action: string | undefined, addr: string): string => {
                if (!action) return `<span>${addr}</span>`;
                return (
                    `<span class="disasm_${action}_offset" ` +
                    `onclick="window.i8080disasm.click_go_${action}('${addr}')">` +
                    addr +
                    `</span>`
                );
            };

            if (instr.arg1) {
                const action = instr.code ? "code" : instr.data1 ? "data" : undefined;
                line += " " + format_argument(action, instr.arg1);
            }

            if (instr.arg2) {
                const action = instr.data2 ? "data" : undefined;
                line += ", " + format_argument(action, instr.arg2);
            }

            output.push(line);
            addr = this.wrap(addr + instr.length);
        }
        return output.join("<br />");
    }

    #code(addr: number, lines: number): void {
        const element = document.getElementById("disasm_code");
        if (!element) throw new Error("disasm_code element not found");
        element.innerHTML = this.renderCode(addr, lines);
    }

    renderDump(address: number, lines: number): string {
        const output = [];

        let addr = address;
        let n = lines;
        while (n--) {
            let line = hex16(addr) + ": ";
            for (let i = 0; i < DATA_WIDTH; ++i) {
                line += hex8(this.memory.read(addr + i)) + " ";
            }
            line += "";
            for (let i = 0; i < DATA_WIDTH; ++i) {
                const ch = this.memory.read(addr + i);
                line += String.fromCharCode(ch < 32 || ch > 127 ? 0x2e : ch);
            }
            addr = this.wrap(addr + DATA_WIDTH);
            output.push(line);
        }
        return output.join("<br />");
    }

    #dump(addr: number, lines: number): void {
        const element = document.getElementById("disasm_data");
        if (!element) throw new Error("disasm_data element not found");
        element.innerHTML = this.renderDump(addr, lines);
    }

    form_go_code() {
        const addr = parseInt("0x" + document.getElementById("disasm_code_address").value);
        const nb_lines = parseInt(document.getElementById("disasm_code_nb_lines").value);
        this.#code(addr, nb_lines);
    }

    go_code(addr: number): void {
        document.getElementById("disasm_code_address").value = hex16(addr);
        const nb_lines = parseInt(document.getElementById("disasm_code_nb_lines").value);
        this.#code(addr, nb_lines);
    }

    form_code_shift(one: boolean, direction: number): void {
        const addr = parseInt("0x" + document.getElementById("disasm_code_address").value);
        const nb_lines = one ? 1 : parseInt(document.getElementById("disasm_code_nb_lines").value);
        this.#code_shift(addr, direction * nb_lines);
    }

    click_go_code(addr: string): void {
        document.getElementById("disasm_code_address").value = addr;
        this.form_go_code();
    }

    #code_shift(address: number, lines: number): number {
        let addr = address;
        let n = lines;
        if (n < 0) {
            while (n++ < 0) {
                let i;
                for (i = 3; i > 0; --i) {
                    const descr = this.disasm(this.wrap(addr - i));
                    if (descr.length == i) break;
                }
                i = i > 0 ? i : 1;
                addr = this.wrap(addr - i);
            }
        } else {
            while (n-- > 0) {
                const descr = this.disasm(addr);
                addr = this.wrap(addr + descr.length);
            }
        }
        this.click_go_code(hex16(addr));
        return addr;
    }

    form_go_data(): void {
        const disasm_data_address = document.getElementById("disasm_data_address") as HTMLInputElement;
        if (!disasm_data_address) throw new Error("disasm_data_address element not found");

        const addr = parseInt("0x" + disasm_data_address.value);

        const disasm_data_nb_lines = document.getElementById("disasm_data_nb_lines") as HTMLInputElement;
        if (!disasm_data_nb_lines) throw new Error("disasm_data_nb_lines element not found");

        const nb_lines = parseInt(disasm_data_nb_lines.value);

        this.#dump(addr, nb_lines);
    }

    click_go_data(addr: string): void {
        document.getElementById("disasm_data_address").value = addr;
        this.form_go_data();
    }

    go_data_shift(direction: number, step: { one?: boolean } = {}): void {
        const { one } = step;
        const offset = one ? 1 : DATA_WIDTH;

        const from = parseInt("0x" + document.getElementById("disasm_data_address").value);
        const to = this.wrap(from + offset * direction);
        this.click_go_data(hex16(to));
    }

    refresh() {
        this.form_go_code();
        this.form_go_data();
    }
}

export default I8080DisasmPanel;
