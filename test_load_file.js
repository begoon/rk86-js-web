export async function load_file(name, memory, tracer) {
    const image = await Bun.file("./test/" + name).bytes();
    image.forEach((byte, i) => memory.write(0x100 + i, byte));
    tracer.writeln(`> LOAD ${name} ${image.length}`);
}
