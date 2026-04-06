<script lang="ts">
    import { i8080_opcode } from "$lib/i8080_disasm";

    let { memory, pc, onclose }: { memory: any; pc: () => number; onclose: () => void } = $props();

    let panel = $state<HTMLDivElement>();
    let dragging = $state(false);
    let dragOffset = { x: 0, y: 0 };

    function onMouseDown(e: MouseEvent) {
        if ((e.target as HTMLElement).closest("button, input")) return;
        dragging = true;
        const rect = panel!.getBoundingClientRect();
        dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        e.preventDefault();
    }
    function onMouseMove(e: MouseEvent) {
        if (!dragging || !panel) return;
        panel.style.left = `${e.clientX - dragOffset.x}px`;
        panel.style.top = `${e.clientY - dragOffset.y}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
    }
    function onMouseUp() { dragging = false; }

    const hex = (v: number) => v.toString(16).toUpperCase();
    const hex8 = (v: number) => hex(v).padStart(2, "0");
    const hex16 = (v: number) => hex(v).padStart(4, "0");
    const DATA_WIDTH = 8;

    function wrap(addr: number): number {
        return (addr + memory.length()) % memory.length();
    }

    function disasm(addr: number) {
        return i8080_opcode(memory.read(addr), memory.read(addr + 1), memory.read(addr + 2));
    }

    let codeAddr = $state("0000");
    let codeLines = $state(22);
    let dataAddr = $state("0000");
    let dataLines = $state(8);

    let codeHtml = $state("");
    let dataHtml = $state("");

    function renderCode() {
        let addr = parseInt("0x" + codeAddr);
        const lines = [];
        for (let i = 0; i < codeLines; i++) {
            const instr = disasm(addr);
            let line = hex16(addr) + ": ";
            let chars = "";
            for (let j = 0; j < instr.length; ++j) {
                const ch = memory.read(addr + j);
                line += hex8(ch);
                chars += String.fromCharCode(ch < 32 || ch > 127 ? 0x2e : ch);
            }
            chars += "&nbsp;".repeat(3 - instr.length);
            chars = chars.replace(" ", "&nbsp;");
            line += "&nbsp;".repeat((3 - instr.length) * 2) + " " + chars + " ";
            const color = instr.bad ? "red" : "white";
            line += `<span style='color: ${color};'>${instr.cmd}</span>`;
            line += "&nbsp;".repeat(5 - instr.cmd.length);

            const fmtArg = (action: string | undefined, a: string): string => {
                if (!action) return `<span>${a}</span>`;
                return `<span class="disasm_${action}_offset" data-addr="${a}">${a}</span>`;
            };
            if (instr.arg1) {
                const action = instr.code ? "code" : instr.data1 ? "data" : undefined;
                line += " " + fmtArg(action, instr.arg1);
            }
            if (instr.arg2) {
                const action = instr.data2 ? "data" : undefined;
                line += ", " + fmtArg(action, instr.arg2);
            }
            lines.push(line);
            addr = wrap(addr + instr.length);
        }
        codeHtml = lines.join("<br />");
    }

    function renderData() {
        let addr = parseInt("0x" + dataAddr);
        const lines = [];
        for (let i = 0; i < dataLines; i++) {
            let line = hex16(addr) + ": ";
            for (let j = 0; j < DATA_WIDTH; ++j) line += hex8(memory.read(addr + j)) + " ";
            for (let j = 0; j < DATA_WIDTH; ++j) {
                const ch = memory.read(addr + j);
                line += String.fromCharCode(ch < 32 || ch > 127 ? 0x2e : ch);
            }
            addr = wrap(addr + DATA_WIDTH);
            lines.push(line);
        }
        dataHtml = lines.join("<br />");
    }

    function refresh() { renderCode(); renderData(); }

    function goCodePC() {
        codeAddr = hex16(pc());
        renderCode();
    }

    function codeShift(direction: number, one = false) {
        let addr = parseInt("0x" + codeAddr);
        let n = direction * (one ? 1 : codeLines);
        if (n < 0) {
            while (n++ < 0) {
                let i;
                for (i = 3; i > 0; --i) {
                    const d = disasm(wrap(addr - i));
                    if (d.length === i) break;
                }
                addr = wrap(addr - (i > 0 ? i : 1));
            }
        } else {
            while (n-- > 0) {
                addr = wrap(addr + disasm(addr).length);
            }
        }
        codeAddr = hex16(addr);
        renderCode();
    }

    function dataShift(direction: number, one = false) {
        const offset = one ? 1 : DATA_WIDTH;
        const from = parseInt("0x" + dataAddr);
        dataAddr = hex16(wrap(from + offset * direction));
        renderData();
    }

    function handleCodeClick(e: MouseEvent) {
        const el = (e.target as HTMLElement).closest("[data-addr]") as HTMLElement | null;
        if (!el) return;
        const addr = el.dataset.addr!;
        if (el.classList.contains("disasm_code_offset")) { codeAddr = addr; renderCode(); }
        else if (el.classList.contains("disasm_data_offset")) { dataAddr = addr; renderData(); }
    }

    $effect(() => {
        if (memory) { goCodePC(); renderData(); }
    });
</script>

<svelte:window on:mousemove={onMouseMove} on:mouseup={onMouseUp} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="disasm-panel" bind:this={panel} onmousedown={onMouseDown} onkeydown={(e) => e.stopPropagation()} onkeyup={(e) => e.stopPropagation()}>
    <div class="titlebar">
        <span>Disassembler</span>
        <button class="close-btn" type="button" onclick={onclose}>&times;</button>
    </div>
    <div class="toolbar">
        <button type="button" onclick={() => codeShift(-1)}>«</button>
        <button type="button" onclick={() => codeShift(-1, true)}>‹</button>
        <input type="text" bind:value={codeAddr} style="width: calc(4ch + 4px)" />
        /
        <input type="number" bind:value={codeLines} style="width: calc(3ch + 4px)" />
        <button type="button" onclick={renderCode}>▶</button>
        <button type="button" onclick={() => codeShift(1, true)}>›</button>
        <button type="button" onclick={() => codeShift(1)}>»</button>
        <button type="button" onclick={goCodePC} style="margin-left: 4px">PC</button>
    </div>
    <hr />
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <code onclick={handleCodeClick}>{@html codeHtml}</code>
    <hr />
    <div class="toolbar">
        <button type="button" onclick={() => dataShift(-1)}>«</button>
        <button type="button" onclick={() => dataShift(-1, true)}>‹</button>
        <input type="text" bind:value={dataAddr} style="width: calc(4ch + 4px)" />
        /
        <input type="number" bind:value={dataLines} style="width: calc(3ch + 4px)" />
        <button type="button" onclick={renderData}>▶</button>
        <button type="button" onclick={() => dataShift(1, true)}>›</button>
        <button type="button" onclick={() => dataShift(1)}>»</button>
    </div>
    <hr />
    <code>{@html dataHtml}</code>
</div>

<style>
    .disasm-panel {
        position: fixed;
        right: 10px;
        bottom: 40px;
        width: fit-content;
        height: fit-content;
        overflow: auto;
        background-color: #000000;
        color: #ffffff;
        border: 1px solid #444;
        font-family: monospace;
        font-size: small;
        z-index: 1000;
        cursor: move;
        user-select: none;
    }
    .titlebar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #333;
        padding: 1px 4px;
        font-size: 9pt;
    }
    .close-btn {
        all: unset;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        padding: 0 2px;
    }
    .close-btn:hover { color: red; }
    .toolbar {
        padding: 2px 4px;
    }
    .toolbar button {
        font-family: monospace;
        font-size: 1.1em;
        width: 1.8em;
    }
    .toolbar input {
        box-sizing: border-box;
        padding: 2px;
        margin: 0;
        border: none;
        font-family: monospace;
    }
    hr { margin: 2px 0; }
    code {
        display: block;
        padding: 2px 4px;
        white-space: nowrap;
        cursor: default;
    }
    :global(.disasm_code_offset) {
        color: lightgreen;
        cursor: pointer;
    }
    :global(.disasm_data_offset) {
        color: lightblue;
        cursor: pointer;
    }
</style>
