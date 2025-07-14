import { readFile } from "node:fs/promises";

/**
 * @typedef {import('./test_load_file').load_file} load_file
 */

/** @type {load_file} */
export async function load_file(name, memory, tracer) {
    const image = await readFile("./test/" + name);
    image.forEach((byte, i) => memory.write(0x100 + i, byte));
    tracer.writeln(`> LOAD ${name} ${image.length}`);
}
