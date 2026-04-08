import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { I8080 } from "../src/lib/i8080.ts";
import { Keyboard } from "../src/lib/rk86_keyboard.ts";
import type { Machine } from "../src/lib/rk86_machine.js";
import { Memory } from "../src/lib/rk86_memory.js";
import { Screen } from "../src/lib/rk86_screen.js";
import { rk86_snapshot_restore } from "../src/lib/rk86_snapshot.js";

globalThis.Image = function () {} as any;

const io = {
    input: (_port: number): number => 0,
    output: (_port: number, _value: number): void => {},
    interrupt: (_iff: number): void => {},
};

const fakeCtx = {
    imageSmoothingEnabled: true,
    fillStyle: "",
    fillRect() {},
    drawImage() {},
    clearRect() {},
};

const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0 };

function createMachine(): Machine {
    const keyboard = new Keyboard();
    const ui = {
        canvas: fakeCanvas,
        resize_canvas(_w: number, _h: number) {
            fakeCanvas.width = _w;
            fakeCanvas.height = _h;
        },
        update_screen_geometry() {},
        update_video_memory_address() {},
    };

    const stub = { ui, io, keyboard, font: "" } as any;
    const memory = new Memory(stub);
    stub.memory = memory;

    const cpu = new I8080({ memory, io });
    stub.cpu = cpu;

    const screen = new Screen(stub);
    stub.screen = screen;
    screen.init();

    return stub as Machine;
}

function loadSnapshot(path: string): Record<string, any> {
    return JSON.parse(readFileSync(path, "utf-8"));
}

function restoreMachine(snapshotPath: string): Machine {
    const machine = createMachine();
    const json = loadSnapshot(snapshotPath);
    const ok = rk86_snapshot_restore(json, machine);
    expect(ok).toBe(true);
    return machine;
}

const dataDir = join(import.meta.dir, "data");
const snapshotFiles = readdirSync(dataDir)
    .filter((f) => f.startsWith("light") && f.endsWith(".json"))
    .sort();

test(`found ${snapshotFiles.length} light*.json snapshots`, () => {
    expect(snapshotFiles.length).toBeGreaterThanOrEqual(2);
});

test("all light*.json snapshots produce identical machine state", () => {
    const machines = snapshotFiles.map((f) => ({
        name: f,
        machine: restoreMachine(join(dataDir, f)),
    }));

    const reference = machines[0];

    for (let i = 1; i < machines.length; i++) {
        const current = machines[i];

        // Compare CPU registers
        expect(current.machine.cpu.regs, `${current.name} vs ${reference.name}: CPU regs`).toEqual(
            reference.machine.cpu.regs,
        );
        expect(current.machine.cpu.pc, `${current.name} vs ${reference.name}: PC`).toBe(reference.machine.cpu.pc);
        expect(current.machine.cpu.sp, `${current.name} vs ${reference.name}: SP`).toBe(reference.machine.cpu.sp);
        expect(current.machine.cpu.iff, `${current.name} vs ${reference.name}: IFF`).toBe(reference.machine.cpu.iff);

        // Compare CPU flags
        expect(current.machine.cpu.sf, `${current.name} vs ${reference.name}: SF`).toBe(reference.machine.cpu.sf);
        expect(current.machine.cpu.zf, `${current.name} vs ${reference.name}: ZF`).toBe(reference.machine.cpu.zf);
        expect(current.machine.cpu.hf, `${current.name} vs ${reference.name}: HF`).toBe(reference.machine.cpu.hf);
        expect(current.machine.cpu.pf, `${current.name} vs ${reference.name}: PF`).toBe(reference.machine.cpu.pf);
        expect(current.machine.cpu.cf, `${current.name} vs ${reference.name}: CF`).toBe(reference.machine.cpu.cf);

        // Compare keyboard
        expect(current.machine.keyboard.export(), `${current.name} vs ${reference.name}: keyboard`).toEqual(
            reference.machine.keyboard.export(),
        );

        // Compare screen
        expect(current.machine.screen.export(), `${current.name} vs ${reference.name}: screen`).toEqual(
            reference.machine.screen.export(),
        );

        // Compare memory (full 64KB)
        expect(current.machine.memory.export(), `${current.name} vs ${reference.name}: memory`).toEqual(
            reference.machine.memory.export(),
        );
    }
});
