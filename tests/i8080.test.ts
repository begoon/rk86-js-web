import { env } from "node:process";

import { beforeEach, expect, test } from "bun:test";

import { hex8 } from "../hex.ts";
import { I8080 } from "../i8080.ts";
import { Memory } from "../rk86_memory.ts";

import { CPI } from "./data/cpi_data.ts";
import { DAA } from "./data/daa_data.ts";

let memory: Memory;
let cpu: I8080;

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
    cpu.cf = 1;
    cpu.hf = 1;
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
    expect(cpu.sf).toBe(0);
    expect(cpu.zf).toBe(0);
    expect(cpu.hf).toBe(1);
    expect(cpu.pf).toBe(0);
    expect(cpu.cf).toBe(1);
    expect(cpu.store_flags()).toBe(0b00010011);
});

test("daa/*", () => {
    cpu.set_rp(0, 0xaabb); // bc
    cpu.set_rp(2, 0xccdd); // de
    cpu.set_rp(4, 0xeeff); // hl
    cpu.set_rp(6, 0x1122); // sp

    cpu.pc = 0x0001;

    for (let cf = 0; cf < 2; ++cf) {
        for (let hf = 0; hf < 2; ++hf) {
            for (let a = 0; a < 256; ++a) {
                cpu.cf = cf;
                cpu.hf = hf;
                cpu.set_a(a);

                cpu.execute(0x27); // DAA

                // Should not advance PC because DAA has no arguments.
                expect(cpu.pc).toBe(0x0001);

                expect(cpu.bc()).toBe(0xaabb);
                expect(cpu.de()).toBe(0xccdd);
                expect(cpu.hl()).toBe(0xeeff);
                expect(cpu.sp).toBe(0x1122);

                const i = a + (hf << 8) + (cf << 9);
                const result =
                    `` +
                    `cf:${cf} hf:${hf} a:${hex8(a)} -> ` +
                    `a:${hex8(cpu.a())} ` +
                    `flags:${cpu.store_flags().toString(2).padStart(8, "0")}`;

                expect(result).toBe(DAA[i]);
            }
        }
    }
});

test("cpi/*", async () => {
    cpu.set_rp(0, 0xaabb); // bc
    cpu.set_rp(2, 0xccdd); // de
    cpu.set_rp(4, 0xeeff); // hl
    cpu.set_rp(6, 0x1122); // sp

    let i = 0;

    const output = [];
    for (let a = 0; a < 0x100; ++a) {
        for (let imm8 = 0; imm8 < 0x100; ++imm8) {
            cpu.pc = 0x0000;

            cpu.set_a(a);
            cpu.retrieve_flags(0x00);
            memory.write_raw(cpu.pc, imm8);

            cpu.execute(0xfe); // CPI

            expect(cpu.pc).toBe(0x0001);

            expect(cpu.bc()).toBe(0xaabb);
            expect(cpu.de()).toBe(0xccdd);
            expect(cpu.hl()).toBe(0xeeff);
            expect(cpu.sp).toBe(0x1122);

            const result =
                `` +
                `a:${hex8(a)} imm8:${hex8(imm8)} -> ` +
                `a:${hex8(cpu.a())} ` +
                `flags:${cpu.store_flags().toString(2).padStart(8, "0")}`;

            expect(result).toBe(CPI[i]);
            i += 1;

            output.push(result);
        }
    }

    if (env.UPDATE) await Bun.write("./tests/cpi_data-X.js", "export const CPI = " + JSON.stringify(output, null, 4));
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
