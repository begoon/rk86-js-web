<script lang="ts">
    let { onrun, onclose }: { onrun: (cmd: string) => void; onclose: () => void } = $props();

    let panel = $state<HTMLDivElement>();
    let output = $state<HTMLDivElement>();
    let input = $state<HTMLInputElement>();
    let dragging = $state(false);
    let dragOffset = { x: 0, y: 0 };

    let history: string[] = [];
    let historyIndex = 0;

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

    function handleKeydown(e: KeyboardEvent) {
        e.stopPropagation();
        if (!input) return;
        switch (e.key) {
            case "Escape":
                e.preventDefault();
                input.value = "";
                break;
            case "Enter": {
                e.preventDefault();
                const cmd = input.value.trim();
                if (!cmd) return;
                input.value = "";
                put(cmd);
                onrun(cmd);
                if (historyIndex === 0 && history[0] === cmd) return;
                history.unshift(cmd);
                if (history.length > 100) history.pop();
                historyIndex = 0;
                break;
            }
            case "ArrowUp":
                e.preventDefault();
                browseHistory(1);
                break;
            case "ArrowDown":
                e.preventDefault();
                browseHistory(-1);
                break;
        }
    }

    function browseHistory(direction: number) {
        if (!input) return;
        if (input.value.trim()) historyIndex += direction;
        historyIndex = (historyIndex + history.length) % history.length;
        input.value = history[historyIndex] ?? "";
    }

    export function put(str: string) {
        if (!output) return;
        const html = str.replaceAll(" ", "&nbsp;");
        output.innerHTML += `<div>${html}</div>`;
        setTimeout(() => {
            if (output) output.scrollTop = output.scrollHeight;
        }, 0);
    }

    export function focus() {
        input?.focus();
    }

    export function getHistory(): string[] {
        return history;
    }

    $effect(() => {
        input?.focus();
    });
</script>

<svelte:window on:mousemove={onMouseMove} on:mouseup={onMouseUp} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="terminal-panel" bind:this={panel} onmousedown={onMouseDown}>
    <div class="titlebar">
        <span>Консоль</span>
        <button class="close-btn" type="button" onclick={onclose}>&times;</button>
    </div>
    <div class="terminal-body">
        <div class="output" bind:this={output}></div>
        <!-- svelte-ignore a11y_autofocus -->
        <input
            type="text"
            class="input"
            bind:this={input}
            onkeydown={handleKeydown}
            onkeypress={(e) => e.stopPropagation()}
            onkeyup={(e) => e.stopPropagation()}
            autofocus
        />
    </div>
</div>

<style>
    .terminal-panel {
        position: fixed;
        right: 10px;
        bottom: 40px;
        width: 81ch;
        z-index: 1000;
        border: 1px solid green;
        cursor: move;
        user-select: none;
    }
    .titlebar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #111;
        color: lightgreen;
        padding: 2px 8px;
        font-size: 9pt;
        font-family: monospace;
    }
    .close-btn {
        all: unset;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        padding: 0 2px;
        color: lightgreen;
    }
    .close-btn:hover { color: red; }
    .terminal-body {
        background-color: black;
        padding: 4px;
    }
    .output {
        height: 30em;
        color: lightgreen;
        font-family: monospace;
        font-size: small;
        overflow-y: auto;
        margin-bottom: 0.5em;
    }
    .input {
        width: 100%;
        box-sizing: border-box;
        background: black;
        color: lightgreen;
        border: 1px solid green;
        font-family: monospace;
        font-size: small;
        padding: 2px 4px;
        outline: none;
    }
</style>
