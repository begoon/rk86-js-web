import { beforeEach, expect, test } from "bun:test";

import { I8080 } from "../i8080.js";
import { Memory } from "../rk86_memory.js";

let memory;
let cpu;

beforeEach(() => {
    memory = new Memory(undefined);

    memory.write_raw(0x0001, 0x27); // DAA

    memory.write_raw(0xffff, 0xfe); // CPI data8
    memory.write_raw(0x0000, 0xaa);

    cpu = new I8080({ memory, io: undefined });
});

test("init", () => {
    expect(cpu.pc).toBe(0x0000);
    expect(cpu.sp).toBe(0x0000);
    expect(cpu.a()).toBe(0x00);
    expect(cpu.b()).toBe(0x00);
    expect(cpu.c()).toBe(0x00);
    expect(cpu.d()).toBe(0x00);
    expect(cpu.e()).toBe(0x00);
    expect(cpu.h()).toBe(0x00);
    expect(cpu.l()).toBe(0x00);
});

test("instruction", () => {
    cpu.pc = 0xffff;
    cpu.instruction();
    // CPI data8 is placed at 0xffff, a memory wrapping boundary.
    // PC should wrap around to 0x0000 and advance by 2 bytes to 0x0002.
    expect(cpu.pc).toBe(0x0001); // CPI data8 is 2 bytes long, so PC should advance by 2
});

test("daa", () => {
    cpu.set_cf = 1;
    cpu.set_hf = 1;
    cpu.set_a(0xaa);

    cpu.set_rp(0, 0xaabb); // bc
    cpu.set_rp(2, 0xccdd); // de
    cpu.set_rp(4, 0xeeff); // hl
    cpu.set_rp(6, 0x0001); // sp

    cpu.pc = 0x0001;
    expect(cpu.execute(0x27)).toBe(4); // 4 cycles
    expect(cpu.pc).toBe(0x0001); // execute does not advance PC

    expect(cpu.bc()).toBe(0xaabb);
    expect(cpu.de()).toBe(0xccdd);
    expect(cpu.hl()).toBe(0xeeff);
    expect(cpu.sp).toBe(0x0001);

    expect(cpu.a()).toBe(0x10);

    // NOTE: The flags need refactoring to either booleans or numbers but not both.
    expect(cpu.sf).toBe(false);
    expect(cpu.zf).toBe(false);
    expect(cpu.hf).toBe(1);
    expect(cpu.pf).toBe(0);
    expect(cpu.cf).toBe(1);
    expect(cpu.store_flags()).toBe(0b00010011);
});

test("unused flags bits defaults", () => {
    // f |= F_UN1; // UN1_FLAG is always 1.
    // f &= ~F_UN3; // UN3_FLAG is always 0.
    // f &= ~F_UN5; // UN5_FLAG is always 0.
    cpu.retrieve_flags(0);
    expect(cpu.store_flags()).toBe(0b00000010);
    cpu.retrieve_flags(0xff);
    expect(cpu.store_flags()).toBe(0b11010111);
});
