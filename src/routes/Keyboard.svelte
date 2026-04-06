<script lang="ts">
    let { onclose }: { onclose: () => void } = $props();

    let panel = $state<HTMLDivElement>();
    let dragging = $state(false);
    let dragOffset = { x: 0, y: 0 };

    function onMouseDown(e: MouseEvent) {
        if ((e.target as HTMLElement).closest(".close-btn")) return;
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

    const keyboardLayout = [
        [
            [";", "+", ";"],
            ["1", "!", "1"],
            ["2", '"', "2"],
            ["3", "#", "3"],
            ["4", "$", "4"],
            ["5", "%", "5"],
            ["6", "&", "6"],
            ["7", "'", "7"],
            ["8", "(", "8"],
            ["9", ")", "9"],
            ["0", "", "0"],
            ["-", "=", "-"],
            ["TAB", "", "TAB"],
            ["ЗБ", "", "BS"],
        ],
        [
            ["Й", "J", "Й"],
            ["Ц", "C", "Ц"],
            ["У", "U", "У"],
            ["К", "K", "К"],
            ["Е", "E", "Е"],
            ["Н", "N", "Н"],
            ["Г", "G", "Г"],
            ["Ш", "[", "Ш"],
            ["Щ", "]", "Щ"],
            ["З", "Z", "З"],
            ["Х", "H", "Х"],
            ["*", ":", "*"],
            ["BK", "", "BK"],
        ],
        [
            ["СС", "", "CTRL"],
            ["Ф", "F", "F"],
            ["Ы", "Y", "Y"],
            ["В", "W", "W"],
            ["А", "A", "A"],
            ["П", "P", "P"],
            ["Р", "R", "R"],
            ["О", "O", "O"],
            ["Л", "L", "L"],
            ["Д", "D", "D"],
            ["Ж", "V", "V"],
            ["Э", "\\", "\\"],
            [">", ".", "."],
            ["ПС", "", "DEL"],
        ],
        [
            ["УС", "", "⇧"],
            ["Я", "Q", "Q"],
            ["Ч", "^", "`"],
            ["С", "S", "S"],
            ["М", "M", "M"],
            ["И", "I", "I"],
            ["Т", "T", "T"],
            ["Ь", "X", "X"],
            ["Б", "B", "B"],
            ["Ю", "@", "F7"],
            ["<", ",", ","],
            ["?", "/", "/"],
            ["РУС", "ЛАТ", "F10"],
        ],
    ];

    const padLayout = [
        ["↖︎", "", "HOME"],
        ["Ф1", "", "F1"],
        ["СТР", "", "END"],
        ["←", "", "←"],
        ["↑", "", "↑"],
        ["→", "", "→"],
        ["Ф2", "", "F2"],
        ["Ф3", "", "F3"],
        ["Ф4", "", "F4"],
        ["↓", "", "↓"],
        ["AP2", "", "F5"],
    ];
</script>

<svelte:window on:mousemove={onMouseMove} on:mouseup={onMouseUp} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="keyboard-panel" bind:this={panel} onmousedown={onMouseDown}>
    <div class="titlebar">
        <span>Клавиатура</span>
        <button class="close-btn" type="button" onclick={onclose}>&times;</button>
    </div>
    <div class="keyboard">
    <div class="keyboard-main">
        {#each keyboardLayout as row, i}
            <div class="keyboard-row" style={i % 2 === 1 ? "margin-left: 2em" : ""}>
                {#each row as labels}
                    <div class="key">
                        {#each labels as label}
                            <div>{label || "\u00A0"}</div>
                        {/each}
                    </div>
                {/each}
            </div>
        {/each}
    </div>
    <div class="keyboard-pad">
        {#each padLayout as labels, i}
            <div
                class="key"
                style={i === 9 ? "width: 6em; grid-column: span 2" : ""}
            >
                {#each labels as label}
                    <div>{label || "\u00A0"}</div>
                {/each}
            </div>
        {/each}
    </div>
</div>
</div>

<style>
    .keyboard-panel {
        position: fixed;
        right: 10px;
        bottom: 40px;
        z-index: 900;
        background-color: #222;
        padding: 0;
        border: 1px solid #444;
        border-radius: 8px;
        overflow: hidden;
        cursor: move;
    }
    .titlebar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #333;
        color: white;
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
    }
    .close-btn:hover { color: red; }
    .keyboard {
        display: flex;
        gap: 1em;
        user-select: none;
    }
    .keyboard-row {
        display: flex;
        margin-left: 1em;
    }
    .key {
        display: grid;
        grid-row: repeat(3, 1fr);
        background-color: #333;
        color: #fff;
        border: 1px solid #555;
        width: fit-content;
        min-width: 2em;
        text-align: center;
        padding-left: 4px;
        padding-right: 4px;
    }
    .key div:last-child {
        padding-top: 1em;
    }
    .keyboard-pad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
    }
    .keyboard-pad .key {
        width: 3em;
        margin: 0;
        padding: 0;
    }
</style>
