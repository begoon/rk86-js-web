export class Memory {
    constructor() {
        this.memory = new Array(0x10000).fill(0);
        this.read = (addr) => this.memory[addr & 0xffff] & 0xff;
        this.write = (addr, w8) => (this.memory[addr & 0xffff] = w8 & 0xff);
    }
}

export class IO {
    constructor() {
        this.input = (port) => 0;
        this.output = (port, w8) => {};
        this.interrupt = (iff) => {};
    }
}
