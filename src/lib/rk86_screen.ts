import { fromHex, hex16 } from "./hex.js";
export class Screen {
    static #update_rate = 25;

    machine: any;
    cursor_rate: number;
    char_width: number;
    char_height: number;
    char_height_gap: number;
    cursor_width: number;
    cursor_height: number;
    scale_x: number;
    scale_y: number;
    width: number;
    height: number;
    cursor_state: boolean;
    cursor_x: number;
    cursor_y: number;
    last_cursor_state: boolean;
    last_cursor_x: number;
    last_cursor_y: number;
    font: HTMLImageElement;
    light_pen_x: number;
    light_pen_y: number;
    light_pen_active: number;
    ctx!: CanvasRenderingContext2D;

    constructor(machine: any) {
        this.machine = machine;

        this.cursor_rate = 500;

        this.char_width = 6;
        this.char_height = 8;
        this.char_height_gap = 2;

        this.cursor_width = this.char_width;
        this.cursor_height = 1;

        this.scale_x = 1;
        this.scale_y = 1;

        this.width = 78;
        this.height = 30;

        this.cursor_state = false;
        this.cursor_x = 0;
        this.cursor_y = 0;

        this.last_cursor_state = false;
        this.last_cursor_x = 0;
        this.last_cursor_y = 0;

        this.font = new Image();
        this.font.src = this.machine.font;

        this.light_pen_x = 0;
        this.light_pen_y = 0;
        this.light_pen_active = 0;
    }

    export() {
        const h16 = (n: number) => "0x" + hex16(n);
        return {
            scale_x: this.scale_x,
            scale_y: this.scale_y,
            width: this.width,
            height: this.height,
            cursor_state: this.cursor_state ? 1 : 0,
            cursor_x: this.cursor_x,
            cursor_y: this.cursor_y,
            video_memory_base: h16(this.video_memory_base),
            video_memory_size: h16(this.video_memory_size),
            light_pen_x: this.light_pen_x,
            light_pen_y: this.light_pen_y,
            light_pen_active: this.light_pen_active,
        };
    }

    import(snapshot: any) {
        const h = fromHex;
        this.scale_x = h(snapshot.scale_x);
        this.scale_y = h(snapshot.scale_y);
        this.width = h(snapshot.width);
        this.height = h(snapshot.height);
        this.cursor_state = h(snapshot.cursor_state) ? true : false;
        this.cursor_x = h(snapshot.cursor_x);
        this.cursor_y = h(snapshot.cursor_y);
        this.video_memory_base = h(snapshot.video_memory_base);
        this.video_memory_size = h(snapshot.video_memory_size);
        this.light_pen_x = h(snapshot.light_pen_x);
        this.light_pen_y = h(snapshot.light_pen_y);
        this.light_pen_active = h(snapshot.light_pen_active);
    }

    apply_import() {
        this.set_geometry(this.width, this.height);
        this.set_video_memory(this.video_memory_base);
    }

    start() {
        this.init();
        this.draw_screen();
        this.flip_cursor();

        this.machine.ui.canvas.onmousemove = this.handle_mousemove.bind(this);
        this.machine.ui.canvas.onmouseup = () => (this.light_pen_active = 0);
        this.machine.ui.canvas.onmousedown = () => (this.light_pen_active = 1);
    }

    cache: boolean[] = [];

    init_cache(sz: number): void {
        for (let i = 0; i < sz; ++i) this.cache[i] = true;
    }

    draw_char(x: number, y: number, ch: number): void {
        this.ctx.drawImage(
            this.font,
            2,
            this.char_height * ch,
            this.char_width,
            this.char_height,
            x * this.char_width * this.scale_x,
            y * (this.char_height + this.char_height_gap) * this.scale_y,
            this.char_width * this.scale_x,
            this.char_height * this.scale_y,
        );
    }

    draw_cursor(x: number, y: number, visible: boolean): void {
        const cy = (y: number) => (y * (this.char_height + this.char_height_gap) + this.char_height) * this.scale_y;
        if (this.last_cursor_x !== x || this.last_cursor_y !== y) {
            if (this.last_cursor_state) {
                this.ctx.fillStyle = "#000000";
                this.ctx.fillRect(
                    this.last_cursor_x * this.char_width * this.scale_x,
                    cy(this.last_cursor_y),
                    this.cursor_width * this.scale_x,
                    this.cursor_height * this.scale_y,
                );
            }
            this.last_cursor_state = this.cursor_state;
            this.last_cursor_x = x;
            this.last_cursor_y = y;
        }
        const cx = x * this.char_width * this.scale_x;
        this.ctx.fillStyle = visible ? "#ffffff" : "#000000";
        this.ctx.fillRect(cx, cy(y), this.cursor_width * this.scale_x, this.cursor_height * this.scale_y);
    }

    flip_cursor() {
        this.draw_cursor(this.cursor_x, this.cursor_y, this.cursor_state);
        this.cursor_state = !this.cursor_state;
        setTimeout(() => this.flip_cursor(), this.cursor_rate);
    }

    init() {
        this.ctx = this.machine.ui.canvas.getContext("2d");
    }

    disable_smoothing() {
        this.ctx.imageSmoothingEnabled = false;
    }

    last_width = 0;
    last_height = 0;

    video_memory_size = 0;

    set_geometry(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.video_memory_size = width * height;

        this.machine.ui.update_screen_geometry(this.width, this.height);

        const canvas_width = this.width * this.char_width * this.scale_x;
        const canvas_height = this.height * (this.char_height + this.char_height_gap) * this.scale_y;
        this.machine.ui.resize_canvas(canvas_width, canvas_height);

        this.disable_smoothing();
        this.ctx.fillStyle = "#000000";
        this.ctx.fillRect(0, 0, canvas_width, canvas_height);

        if (this.last_width === this.width && this.last_height === this.height) return;

        console.log(`установлен размер экрана: ${width} x ${height}`);
        this.last_width = this.width;
        this.last_height = this.height;
    }

    video_memory_base = 0;
    last_video_memory_base = 0;

    set_video_memory(base: number): void {
        this.video_memory_base = base;
        this.init_cache(this.video_memory_size);

        this.machine.ui.update_video_memory_address(this.video_memory_base);

        if (this.last_video_memory_base === this.video_memory_base) return;

        console.log(
            `установлена видеопамять с адреса`,
            `${hex16(this.video_memory_base)}`,
            `размером ${hex16(this.video_memory_size)}`,
        );
        this.last_video_memory_base = this.video_memory_base;
    }

    set_cursor(x: number, y: number): void {
        this.draw_cursor(this.cursor_x, this.cursor_y, false);
        this.cursor_x = x;
        this.cursor_y = y;
    }

    draw_screen() {
        const memory = this.machine.memory;
        let i = this.video_memory_base;
        for (let y = 0; y < this.height; ++y) {
            for (let x = 0; x < this.width; ++x) {
                const cache_i = i - this.video_memory_base;
                const ch = memory.read(i);
                if (this.cache[cache_i] !== ch) {
                    this.draw_char(x, y, ch);
                    this.cache[cache_i] = ch;
                }
                i += 1;
            }
        }
        setTimeout(() => this.draw_screen(), Screen.#update_rate);
    }

    handle_mousemove(event: MouseEvent): void {
        const canvas = this.machine.ui.canvas;
        const box = canvas.getBoundingClientRect();

        const scaleX = canvas.width / box.width;
        const scaleY = canvas.height / box.height;

        const mouseX = (event.clientX - box.left) * scaleX;
        const mouseY = (event.clientY - box.top) * scaleY;

        const x = Math.floor(mouseX / (this.char_width * this.scale_x));
        const y = Math.floor(mouseY / ((this.char_height + this.char_height_gap) * this.scale_y));

        this.light_pen_x = x;
        this.light_pen_y = y;
    }
}
