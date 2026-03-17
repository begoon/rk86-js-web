import { hex16 } from "./hex.ts";
import { Machine } from "./rk86_machine.ts";

export function rk86_snapshot(machine: Machine, version: string): string {
    const { screen, cpu, keyboard, memory } = machine;

    const h16 = (n: number) => "0x" + hex16(n);

    const snapshot = {
        id: "rk86",
        created: new Date().toISOString(),
        format: "1",
        emulator: "rk86.ru",
        version: version,
        start: h16(0x0000),
        end: h16(0xffff),
        boot: { keyboard: [] },
        cpu: cpu.export(),
        keyboard: keyboard.export(),
        screen: screen.export(),
        memory: memory.export(),
    };
    return JSON.stringify(snapshot, null, 4);
}

export function rk86_snapshot_restore(
    snapshot: any,
    machine: Machine,
    keys_injector?: (commands: any[]) => void,
): boolean {
    try {
        const json = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot;
        if (json.id != "rk86") return false;

        const { screen, cpu, memory, keyboard } = machine;

        cpu.import(json.cpu);
        keyboard.import(json.keyboard);
        screen.import(json.screen);
        memory.import(json.memory);

        screen.apply_import();
        screen.init_cache(screen.video_memory_size);

        if (keys_injector && json.boot?.keyboard) keys_injector(json.boot?.keyboard);
        return true;
    } catch (e) {
        console.error("failed restoring snapshot", e);
        return false;
    }
}
