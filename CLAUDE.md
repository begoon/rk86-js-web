# Project

RK-86 emulator (Intel 8080 CPU) built with SvelteKit. Also available as a standalone `<radio86-emulator>` web component.

## Stack

- SvelteKit (static adapter, pathname router, prerendered pages)
- Svelte 5 (runes: `$state`, `$effect`, `$derived`, `$props`)
- Tailwind CSS 4
- Bun (runtime, package manager, test runner)
- TypeScript (strict)

## Commands

- `bun run dev` — dev server
- `bun run build` — static build to `build/`
- `just test` — unit tests + i8080 CPU tests
- `just test-ci` — full CI suite
- `bun run check` — svelte-check type checking
- `just release-alpha` / `just release-beta` — deploy with base path
- `just terminal-run [args]` — run terminal emulator locally
- `just terminal-build` — bundle terminal to npm package
- `just build-asm` — assemble all i8080 programs in `info/asm/`

## Structure

- `src/lib/core/` — emulator core (CPU, memory, screen, keyboard, sound interface, runner, disassembler)
- `src/lib/web/` — browser layer (boot, canvas renderer, Web Audio sound, tape with save-to-file)
- `src/lib/terminal/` — terminal emulator (Node.js/Bun, Unicode screen rendering; supports `--headless` mode with `--input`, `--timeout`, `--exit-halt`, `--screen`, `--memory` for e2e testing)
- `src/lib/component/` — standalone `<radio86-emulator>` web component
- `tools/` — build scripts (catalog generator, version)
- `src/routes/` — SvelteKit pages and UI components
- `src/routes/state.svelte.ts` — reactive bridge between imperative engine and Svelte
- `src/routes/catalog/` — program catalog page
- `static/` — static assets (assembler HTML, icons, ROM/program files, catalog data)
- `info/monitor/` — monitor ROM documentation, source, listing
- `info/asm/` — example i8080 assembly programs
- `tests/` — bun unit tests
- `tests/cpu/` — auto-generated table-driven CPU test data (one file per instruction)
- `tests/generate_cpu_data.ts` — generates `tests/cpu/*_data.ts` from the CPU implementation
- `tests/rk86_terminal_e2e.test.ts` — e2e tests that spawn the terminal emulator in `--headless` mode and assert on screen/memory dumps

## Generated files (gitignored)

- `src/lib/tape_catalog.ts` — file list from `static/files/`
- `src/lib/catalog_data.ts` — catalog metadata from `static/catalog/*/info.md`
- `src/lib/rk86_version.ts` — build timestamp
- `static/radio86-emulator.js` — bundled web component

All four are auto-generated via `svelte.config.js` on every build/dev.

- `tests/cpu/*_data.ts` — CPU test tables (regenerate with `bun tests/generate_cpu_data.ts`)

## Conventions

- Source of truth for programs: `static/files/` — every file must have `static/catalog/<name>/info.md`
- Imports use `.js` extension in `.ts` files (SvelteKit/Vite requirement)
- `$lib` alias points to `src/lib/`
- Debugger mode: combined view with 1:1 canvas (top-left), disassembler (right), console (below). Canvas click focuses keyboard input to emulator; clicking disassembler/console redirects input there
- Floating panels (visualizer, keyboard) are non-modal, draggable Svelte components
- Disassembler and Terminal are embedded-only (no standalone floating mode)
- Assembler is an iframe (`static/i8080asm.html`) accessing `window.parent.machine`
- `window.machine` is exposed for the assembler iframe
- UI state from engine callbacks flows through `state.svelte.ts` (reactive `$state` object)
- Machine methods (`reset`, `restart`, `pause`, `loadCatalogFile`, `runLoadedFile`, `uploadFile`) are assigned in `boot.ts`
- Keyboard shortcuts: `Cmd/Ctrl+K` then a letter key (`D` for debugger, `A` for assembler, etc.)
- Icon buttons in toolbar are non-focusable (`tabindex=-1`) to prevent accidental activation via Enter/Space
- Dialogs blur active element on close to prevent focus returning to triggering button
- `BASE_PATH` env var sets deployment base path (e.g. `BASE_PATH=/alpha bun run build`)
- URL auto-load: `?file=` / `?run=` (load + run) and `?load=` (load only) in `boot.ts`. Value can be a catalog name, absolute URL, or `data:[;name=<filename>];base64,<payload>` data URL. `name=` hint drives extension-based parser selection; defaults to `inline.bin`. URL values are `decodeURIComponent`-ed before decoding; URL-safe base64 (`-_`) is normalized to standard (`+/`)
- All text in UI is in Russian
