<script lang="ts">
    import { type Machine } from "$lib/rk86_machine";

    let shortcutsDialog = $state<HTMLDialogElement>();
    let hintText = $state("");

    import { main } from "./main";
    import { ui } from "./ui_state.svelte";
    import Keyboard from "./Keyboard.svelte";
    import CatalogSelector from "./CatalogSelector.svelte";
    import Visualizer from "./Visualizer.svelte";
    import Disassembler from "./Disassembler.svelte";
    import Terminal from "./Terminal.svelte";
    import CLI from "$lib/rk86_cli";

    let keyboardVisible = $state(false);
    let catalogDialog = $state<HTMLDialogElement>();
    let uploadInput = $state<HTMLInputElement>();

    let canvas = $state<HTMLCanvasElement>();

    let machine = $state<Machine>();

    $effect(() => {
        setTimeout(async () => {
            if (!canvas) {
                console.error("canvas element not found");
                return;
            }
            machine = await main(canvas)!;
            machine.ui.toggle_assembler = toggleAssembler;
            machine.ui.on_visualizer_hit = (opcode: number) => { ui.visualizerOpcode = opcode; };
            machine.ui.on_pause_changed = (value: boolean) => { paused = value; };
            machine.ui.terminal = {
                put: (str: string) => terminalRef?.put(str),
                get history() { return terminalRef?.getHistory() ?? []; },
            };
            cli = new CLI(machine);
            window.machine = machine;
        }, 0);
    });

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            canvas?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    function togglePaused() {
        paused = !paused;
        machine?.pause(paused);
    }

    function toggleAssembler() {
        assemblerVisible = !assemblerVisible;
    }

    function toggleVisualizer() {
        visualizerVisible = !visualizerVisible;
        if (machine) machine.ui.visualizer_visible = visualizerVisible;
    }

    function toggleDisassembler() {
        disassemblerVisible = !disassemblerVisible;
    }

    function toggleTerminal() {
        terminalVisible = !terminalVisible;
        if (terminalVisible) setTimeout(() => terminalRef?.focus(), 0);
    }

    const shortcuts: Record<string, () => void> = {
        f: toggleFullscreen,
        r: () => machine?.restart(),
        p: togglePaused,
        s: toggleSound,
        a: toggleAssembler,
        v: toggleVisualizer,
        d: toggleDisassembler,
        k: toggleTerminal,
        b: () => (keyboardVisible = !keyboardVisible),
        l: () => catalogDialog?.showModal(),
        u: () => uploadInput?.click(),
        g: () => machine?.runLoadedFile(),
        w: () => machine?.ui.emulator_snapshot(),
    };

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (shortcutsDialog?.open) {
                shortcutsDialog.close();
            } else {
                shortcutsDialog?.showModal();
            }
            return;
        }
        if (shortcutsDialog?.open) {
            const action = shortcuts[e.key];
            if (action) {
                e.preventDefault();
                shortcutsDialog.close();
                action();
            }
            return;
        }
        if (catalogDialog?.open || disassemblerVisible || terminalVisible) return;
        if (machine) machine.keyboard.onkeydown(e.code);
    }

    function onKeyUp(e: KeyboardEvent) {
        if (catalogDialog?.open || disassemblerVisible || terminalVisible) return;
        if (machine) machine.keyboard.onkeyup(e.code);
    }

    let paused = $state(false);
    let fullscreen = $state(false);
    let assemblerVisible = $state(false);
    let visualizerVisible = $state(false);
    let disassemblerVisible = $state(false);
    let terminalVisible = $state(false);
    let terminalRef = $state<Terminal>();
    let cli: CLI;

    let soundEnabled = $state(false);
    let soundImageVisible = $state(false);
    let soundImageTimeout: ReturnType<typeof setTimeout>;

    function toggleSound() {
        soundEnabled = !soundEnabled;
        machine?.runner.init_sound(soundEnabled);
        soundImageVisible = true;
        clearTimeout(soundImageTimeout);
        soundImageTimeout = setTimeout(() => (soundImageVisible = false), 2000);
    }
</script>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />
<svelte:document on:fullscreenchange={() => (fullscreen = Boolean(document.fullscreenElement))} />

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<main
    onmouseover={(e) => {
        const button = (e.target as HTMLElement).closest("button[data-text]") as HTMLElement | null;
        hintText = button?.dataset.text ?? "";
    }}
    onmouseout={(e) => {
        const button = (e.target as HTMLElement).closest("button[data-text]") as HTMLElement | null;
        if (button) hintText = "";
    }}
>
    <div id="header" class={fullscreen ? "hidden" : ""}>
        <button class="icon" data-text="Сигнал RESET" onclick={() => machine?.reset()}>
            <img class="icon" src="i/reset.svg" alt="Сигнал RESET" />
        </button>
        <button class="icon" data-text="Перезапустить эмулятор" onclick={() => machine?.restart()}>
            <img class="icon" src="i/power-off.svg" alt="Перезапустить эмулятор" />
        </button>
        <button class="icon" data-text="Приостановить процессор" onclick={togglePaused}>
            {#if paused}
                <img class="icon" src="i/paused.svg" alt="Процессор приостановлен" />
            {:else}
                <img class="icon" src="i/pause.svg" alt="Приостановить процессор" />
            {/if}
        </button>
        <button class="icon" data-text="Полноэкранный режим" onclick={toggleFullscreen}>
            <img class="icon" src="i/fullscreen.svg" alt="Полноэкранный режим" />
        </button>
        <button type="button" class="icon" class:active={keyboardVisible} data-text="Клавиатура" onclick={() => (keyboardVisible = !keyboardVisible)}>
            <img class="icon" src="i/keyboard.svg" alt="Клавиатура" />
        </button>
        <button type="button" class="icon" data-text="Помощь" onclick={() => window.open("help.html", "_blank")}>
            <img class="icon" src="i/help.svg" alt="Помощь" />
        </button>
        <!-- Кнопки справа -->
        <div style="margin-left: auto; display: flex; align-items: center; gap: 4px">
            <button class="icon" data-text="Запись на ленту">
                {#if ui.tapeActivityActive}
                    {#if ui.tapeHighlight}
                        <img class="icon" src="i/tape-data.svg" alt="Данные ленты" />
                    {:else}
                        <img class="icon" src="i/tape-preamble.svg" alt="Преамбула ленты" />
                    {/if}
                {/if}
            </button>
            <button type="button" class="icon" data-text="Выбрать файл из каталога" onclick={() => catalogDialog?.showModal()}>
                <img class="icon" src="i/catalog.svg" alt="Выбрать файл из каталога" />
            </button>
            <input
                bind:this={uploadInput}
                style="display: none"
                type="file"
                onchange={async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) await machine?.uploadFile(file);
                    if (uploadInput) uploadInput.value = "";
                }}
            />
            <button type="button" class="icon" data-text="Загрузить внешний файл" onclick={() => uploadInput?.click()}>
                <img class="icon" src="i/upload.svg" alt="Загрузить внешний файл" />
            </button>
            <button type="button" class="icon" data-text="Запустить программу" onclick={() => machine?.runLoadedFile()}>
                <img class="icon" src="i/run.svg" alt="Запустить программу" />
            </button>
            <button type="button" class="icon" class:active={assemblerVisible} data-text="Ассемблер" onclick={toggleAssembler}>
                <img class="icon" src="i/asm.svg" alt="Ассемблер" />
            </button>
            <button type="button" class="icon" class:active={disassemblerVisible} data-text="Дизассемблер" onclick={toggleDisassembler}>
                <img class="icon" src="i/disasm.svg" alt="Дизассемблер" />
            </button>
            <button type="button" class="icon" class:active={visualizerVisible} data-text="Визуализация" onclick={toggleVisualizer}>
                <img class="icon" src="i/visualizer.svg" alt="Визуализация" />
            </button>
            <button type="button" class="icon" data-text="Снимок экрана" onclick={() => machine?.ui.screenshot()}>
                <img class="icon" src="i/screenshot.svg" alt="Снимок экрана" />
            </button>
            <button type="button" class="icon" data-text="Сохранить память в файл" onclick={() => machine?.ui.memory_snapshot()}>
                <img class="icon" src="i/memory.svg" alt="Сохранить память в файл" />
            </button>
            <button type="button" class="icon" data-text="Сохранить полное состояние" onclick={() => machine?.ui.emulator_snapshot()}>
                <img class="icon" src="i/snapshot.svg" alt="Сохранить полное состояние" />
            </button>
            <button type="button" class="icon" class:active={terminalVisible} data-text="Консоль" onclick={toggleTerminal}>
                <img class="icon" src="i/terminal.svg" alt="Консоль" />
            </button>
            <button
                type="button"
                class="icon"
                data-text="Включить/выключить звук"
                onclick={toggleSound}
            >
                {#if soundEnabled}
                    <img class="icon" src="i/sound.svg" alt="Включить звук" />
                {:else}
                    <img class="icon" src="i/sound-muted.svg" alt="Выключить звук" />
                {/if}
            </button>
            <span id="sound_image" class={soundImageVisible ? "visible" : ""}>{soundEnabled ? "🔉" : "🔇"}</span>
            <button>
                <span style="font-family: monospace; background: white; color: black; padding: 2px 4px; border-radius: 2px">{ui.rusLat ? "РУС" : "ЛАТ"}</span>
            </button>
        </div>
    </div>
    <div id="hint" style="opacity: {hintText ? 1 : 0}">{hintText}</div>
    <canvas bind:this={canvas} style={assemblerVisible ? "display: none" : ""}></canvas>
    {#if assemblerVisible}
        <iframe id="assembler_panel" src="i8080asm.html" title="Ассемблер"></iframe>
    {/if}
    {#if visualizerVisible}
        <Visualizer onclose={toggleVisualizer} />
    {/if}
    {#if disassemblerVisible && machine}
        <Disassembler memory={machine.memory} pc={() => machine.cpu.pc} onclose={toggleDisassembler} />
    {/if}
    {#if terminalVisible}
        <Terminal
            bind:this={terminalRef}
            onrun={(cmd) => cli?.run(cmd)}
            onclose={toggleTerminal}
        />
    {/if}
    <div id="footer" style="display: flex; gap: 10px" class={fullscreen ? "hidden" : ""}>
        <div class="gauge">
            <span class="dimmed">ИНСТР</span>
            <span>{Math.floor(ui.ips * 1000).toLocaleString()}</span>
        </div>
        <div class="gauge">
            <span class="dimmed">ТАКТ</span>
            <span>{Math.floor(ui.tps * 1000).toLocaleString()}</span>
        </div>
        <div class="gauge">
            <span class="dimmed">ЭКРАН</span>
            <span>{ui.videoMemoryBase.toString(16).toUpperCase()}</span>
        </div>
        <div class="gauge">
            <span class="dimmed">РАЗМЕР</span>
            <span>{ui.screenWidth}</span>
            <span class="dimmed">x</span>
            <span>{ui.screenHeight}</span>
        </div>
        <div class="gauge">
            <span class="dimmed">ЛЕНТА</span>
            <span class={ui.tapeHighlight ? "tape_active" : ""}>{String(ui.tapeWrittenBytes).padStart(4, "0")}</span>
        </div>
        {#if ui.selectedFileName}
            <div class="gauge">
                <span class="dimmed">ФАЙЛ</span>
                <span>{ui.selectedFileName}</span>
                <span class="dimmed">{ui.selectedFileStart.toString(16).toUpperCase().padStart(4, "0")}-{ui.selectedFileEnd.toString(16).toUpperCase().padStart(4, "0")}</span>
                <span>{ui.selectedFileSize.toString(16).toUpperCase().padStart(4, "0")}</span>
                <span class="dimmed">G{ui.selectedFileEntry.toString(16).toUpperCase().padStart(4, "0")}</span>
            </div>
        {/if}
    </div>
</main>

<dialog
    id="shortcuts"
    bind:this={shortcutsDialog}
    onclick={(e) => {
        if (e.target === e.currentTarget) shortcutsDialog?.close();
    }}
>
    <div>
        <h1 style="font-weight: bold">cmd-k + ...</h1>
        <style>
            mark {
                background-color: #ffcc00;
                color: black;
                padding: 2px 4px;
                border-radius: 4px;
            }
        </style>
        <div id="shortcuts-panel" style="display: grid; grid-template-columns: repeat(2, 1fr)">
            <style>
                #shortcuts-panel div {
                    padding: 4px;
                    white-space: nowrap;
                    text-align: left;
                    display: grid;
                    grid-template-columns: 1.5em auto;
                }
                #shortcuts-panel mark {
                    background-color: #ffcc00;
                    color: black;
                    padding: 2px 4px;
                    border-radius: 4px;
                    text-align: center;
                    margin-right: 4px;
                    text-transform: uppercase;
                }
            </style>
            <!-- --- -->
            <div><mark>l</mark> - выбрать файл из каталога</div>
            <div><mark>u</mark> - загрузить внешний файл</div>
            <div><mark>g</mark> - запустить программу</div>
            <div><mark>k</mark> - консоль</div>
            <div><mark>a</mark> - ассемблер</div>
            <div><mark>d</mark> - дизассемблер</div>
            <div><mark>v</mark> - визуализация</div>
            <div><mark>p</mark> - приостановить процессор</div>
            <div><mark>r</mark> - перезапустить эмулятор</div>
            <div><mark>s</mark> - звук</div>
            <div><mark>f</mark> - полноэкранный режим</div>
            <div><mark>w</mark> - сохранить состояние эмулятора</div>
            <div><mark>b</mark> - помощь по клавиатуре</div>
        </div>
    </div>
</dialog>

{#if keyboardVisible}
    <Keyboard onclose={() => (keyboardVisible = false)} />
{/if}

<dialog
    id="catalog-dialog"
    bind:this={catalogDialog}
    onclick={(e) => {
        if (e.target === e.currentTarget) catalogDialog?.close();
    }}
>
    <CatalogSelector
        onselect={(name) => {
            catalogDialog?.close();
            machine?.loadCatalogFile(name);
        }}
        onclose={() => catalogDialog?.close()}
    />
</dialog>

<style>
    :global(body) {
        margin: 0;
        background-color: #000000;
        color: #ffffff;
        font-family: sans-serif;
    }
    #header,
    #footer {
        box-sizing: border-box;
        display: flex;
        width: 100%;
        padding: 8px;
        flex-shrink: 0; /* do not shrink header/footer */
        font-size: 0.75rem;
    }
    #header.hidden,
    #footer.hidden,
    .icon {
        width: 2em;
        height: 2em;
        vertical-align: middle;
    }
    button.icon {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 2px;
        border: none;
        cursor: pointer;
    }
    button.active {
        padding: 2px;
        outline: 2px solid white;
        border-radius: 8px;
    }
    button {
        font-family: monospace;
    }
    #sound_image {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translateX(-50%) translateY(-50%);
        font-size: 10em;
        opacity: 0;
        transition: opacity 0.5s ease;
        pointer-events: none;
        z-index: 2000;
    }
    #sound_image.visible {
        opacity: 1;
    }
    canvas {
        flex: 1;
        min-height: 0;
        min-width: 0;
        max-width: 100%;
        max-height: 100%;
        aspect-ratio: 78 / 50;
        object-fit: contain;
        display: block;
        align-self: center;
    }
    .dimmed {
        opacity: 0.6;
    }
    .gauge {
        display: flex;
        width: fit-content;
        height: fit-content;
        gap: 4px;
    }
    #shortcuts {
        position: fixed;
        top: 50%;
        left: 50%;
        translate: -50% -50%;
        margin: 0;
        background-color: #333333;
        color: white;
        padding: 10px;
        font-size: 1.2em;
        text-align: center;
        border: none;
        outline: none;
        border-radius: 8px;
    }
    #shortcuts::backdrop,
    #catalog-dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.5);
    }
    #catalog-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        translate: -50% -50%;
        margin: 0;
        background-color: #222;
        color: white;
        padding: 16px;
        border: none;
        outline: none;
        border-radius: 8px;
    }
    #hint {
        position: fixed;
        right: 0;
        bottom: 0;
        transition: opacity 0.3s ease;
        font-size: 3em;
        background-color: white;
        color: black;
        white-space: nowrap;
        padding: 8px 10px;
        border-radius: 4px;
        z-index: 1000;
        pointer-events: none;
    }
    #assembler_panel {
        flex: 1;
        min-height: 0;
        width: 100%;
        border: none;
    }
    main {
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: start;
        justify-content: center;
        overflow: hidden;
    }
    .tape_active {
        color: white;
        background-color: green;
    }
</style>
