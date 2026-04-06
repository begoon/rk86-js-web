import { I8080 } from "./src/lib/i8080.ts";
import { Tracer } from "./test_console_tracer.ts";
import { load_file } from "./test_load_file.ts";
import { IO, Memory } from "./test_machine.ts";

export async function executor(filename: string, verbose = false, timeout = 60 * 20): Promise<{success: boolean, output: string[], duration: string}> {
    const start = performance.now();

    const tracer = new Tracer(verbose);

    const machine: any = { io: new IO() };

    const memory = new Memory(machine);
    await load_file(filename, memory, tracer);
    machine.memory = memory;

    memory.write(5, 0xc9); // Add RET at 0x0005 to handle "CALL 5".

    const cpu = new I8080(machine);
    machine.cpu = cpu;

    cpu.jump(0x100);

    let success = false;
    while (1) {
        const pc = cpu.pc;
        if (memory.read(pc) == 0x76) {
            tracer.flush();
            tracer.writeln("HLT at " + pc.toString(16));
            break;
        }
        if (pc == 0x0005) {
            if (cpu.c() == 9) {
                // Print till '$'.
                for (let i = cpu.de(); memory.read(i) != 0x24; i += 1) {
                    tracer.putchar(memory.read(i));
                }
            }
            if (cpu.c() == 2) tracer.putchar(cpu.e());
        }
        cpu.instruction();
        if (cpu.pc == 0) {
            tracer.flush();
            tracer.writeln("Jump to 0000 from " + pc.toString(16));
            success = tracer.success;
            break;
        }
        if (performance.now() - start > timeout * 1000) {
            tracer.writeln("timeout exceeded");
            tracer.flush();
            success = false;
            break;
        }
    }
    const duration = ((performance.now() - start) / 1000.0).toFixed(3) + "s";
    return { success, output: tracer.output, duration };
}
