import { fromHex, hex16 } from "./hex.js";
export class Screen {
    static #update_rate = 25;

    constructor(machine) {
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

        this.video_memory_base = 0;
        this.video_memory_size = 0;

        this.cache = [];

        this.font = new Image();
        this.font.src = this.machine.font;

        this.light_pen_x = 0;
        this.light_pen_y = 0;
        this.light_pen_active = 0;

        this.last_video_memory_base = -1;
        this.last_video_memory_size = -1;
    }

    export() {
        const h16 = (n) => "0x" + hex16(n);
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

    import(snapshot) {
        const h = fromHex;
        this.scale_x = h(snapshot.scale_x);
        this.scale_y = h(snapshot.scale_y);
        this.width = h(snapshot.width);
        this.height = h(snapshot.height);
        this.cursor_state = h(snapshot.cursor_state);
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

    init_cache(sz) {
        for (let i = 0; i < sz; ++i) this.cache[i] = true;
    }

    draw_char(x, y, ch) {
        this.ctx.drawImage(
            this.font,
            2,
            this.char_height * ch,
            this.char_width,
            this.char_height,
            x * this.char_width * this.scale_x,
            y * (this.char_height + this.char_height_gap) * this.scale_y,
            this.char_width * this.scale_x,
            this.char_height * this.scale_y
        );
    }

    draw_cursor(x, y, visible) {
        const cy = (y) => (y * (this.char_height + this.char_height_gap) + this.char_height) * this.scale_y;
        if (this.last_cursor_x !== x || this.last_cursor_y !== y) {
            if (this.last_cursor_state)
                this.ctx.clearRect(
                    this.last_cursor_x * this.char_width * this.scale_x,
                    cy(this.last_cursor_y),
                    this.cursor_width * this.scale_x,
                    this.cursor_height * this.scale_y
                );
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
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.imageSmoothingEnabled = false;
    }

    set_geometry(width, height) {
        this.width = width;
        this.height = height;
        this.video_memory_size = width * height;

        this.machine.ui.update_screen_geometry(this.width, this.height);
        console.log(`screen geometry: ${width} x ${height}`);

        const canvas_width = this.width * this.char_width * this.scale_x;
        const canvas_height = this.height * (this.char_height + this.char_height_gap) * this.scale_y;
        this.machine.ui.resize_canvas(canvas_width, canvas_height);

        this.disable_smoothing();
        this.ctx.fillRect(0, 0, canvas_width, canvas_height);
    }

    set_video_memory(base) {
        this.video_memory_base = base;
        this.init_cache(this.video_memory_size);

        this.machine.ui.update_video_memory_base(this.video_memory_base);

        if (
            this.last_video_memory_base !== this.video_memory_base ||
            this.last_video_memory_size !== this.video_memory_size
        ) {
            console.log(`video memory:`, `${this.video_memory_base.toString(16)}`, `size: ${this.video_memory_size}`);
            this.last_video_memory_base = this.video_memory_base;
            this.last_video_memory_size = this.video_memory_size;
        }
    }

    set_cursor(x, y) {
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
        setTimeout(() => this.draw_screen(), Screen.update_rate);
    }

    /**
     * @param {MouseEvent} event
     */
    handle_mousemove(event) {
        const canvas = this.machine.ui.canvas;
        const rect = canvas.getBoundingClientRect();

        // Compute scaling factors between CSS size and actual canvas size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Map mouse coordinates from CSS space to canvas space
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;

        // Convert to character grid position
        const x = Math.floor(mouseX / (this.char_width * this.scale_x));
        const y = Math.floor(mouseY / ((this.char_height + this.char_height_gap) * this.scale_y));

        this.light_pen_x = x;
        this.light_pen_y = y;
    }
}
