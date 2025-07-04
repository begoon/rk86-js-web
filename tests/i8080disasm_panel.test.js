import { beforeEach, expect, test } from "bun:test";

import I8080DisasmPanel from "../i8080disasm_panel.js";
import { Memory } from "../rk86_memory.js";

let memory;
let disasm;

beforeEach(() => {
    memory = new Memory(undefined);
    disasm = new I8080DisasmPanel(memory);

    memory.write_raw(0xfffe, 0xcd);
    memory.write_raw(0xffff, 0xaa);
    memory.write_raw(0x0000, 0xbb);
    memory.write_raw(0x0002, 0xff);
});

test("wrap", () => {
    expect(disasm.wrap(0x10000)).toBe(0);
    expect(disasm.wrap(0x10001)).toBe(1);
});

test("disasm", () => {
    expect(disasm.disasm(0xfffe)).toEqual({
        cmd: "CALL",
        length: 3,
        arg1: "BBAA",
        code: true,
    });
});

test("code", () => {
    expect(disasm.renderCode(0xfffe, 3)).toBe(
        (
            "FFFE: CDAABB ... " +
            "<span style='color: white;'>CALL</span>^ " +
            '<span class="disasm_code_offset" onclick="window.i8080disasm.click_go_code(\'BBAA\')">BBAA</span>' +
            `<br />` +
            `0001: 00^^^^ .` +
            `^^ ` +
            `<span style='color: white;'>NOP</span>` +
            `^^` +
            `<br />` +
            `0002: FF^^^^ .^^ ` +
            `<span style='color: white;'>RST</span>^^ <span>7</span>`
        ).replaceAll("^", "&nbsp;")
    );
});

test("dump", () => {
    expect(disasm.renderDump(0xfffe, 3)).toBe(
        "" +
            "FFFE: CD AA BB 00 FF 00 00 00 | ........<br />" +
            "0006: 00 00 00 00 00 00 00 00 | ........<br />" +
            "000E: 00 00 00 00 00 00 00 00 | ........"
    );
});
