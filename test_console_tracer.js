import { hex8 } from "./hex.js";

export class Tracer {
    constructor(verbose) {
        this.line = "";
        this.output = [];
        this.success = false;
        this.verbose = verbose;
    }

    writeln(str) {
        this.output.push(str);
        if (this.verbose) console.log(str);
    }

    flush() {
        if (this.line.includes("OPERATIONAL")) {
            // TEST.COM
            this.success = true;
        }
        if (this.line.includes("CPU HAS FAILED")) {
            // TEST.COM
            this.success = false;
        }
        if (this.line.includes("complete")) {
            // 8080PRE
            this.success = true;
        }
        if (this.line.includes("CPU TESTS OK")) {
            // CPUTEST.COM
            this.success = true;
        }
        if (this.line.includes("Tests complete")) {
            // 8080EX1.COM
            this.success = true;
        }
        this.writeln("OUTPUT: " + this.line);
        this.line = "";
    }

    static ascii7(c) {
        return c >= 0x20 && c < 0x80 ? String.fromCharCode(c) : `<${hex8(c)}>`;
    }

    putchar(c) {
        if (c == 10) return;
        if (this.line == null) this.line = "";
        if (c == 13) this.flush();
        else this.line += Tracer.ascii7(c);
    }
}
