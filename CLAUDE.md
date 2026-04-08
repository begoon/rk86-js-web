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

## Structure

- `src/lib/` — emulator core (CPU, memory, screen, keyboard, sound, runner, disassembler, CLI)
- `src/lib/boot.ts` — machine initialization, wiring UI to emulator
- `src/lib/radio86-emulator.ts` — standalone web component
- `src/lib/build_catalog.ts` — catalog generator (runs at build time via svelte.config.js)
- `src/routes/` — SvelteKit pages and UI components
- `src/routes/ui_state.svelte.ts` — reactive bridge between imperative engine and Svelte
- `src/routes/catalog/` — program catalog page
- `static/` — static assets (assembler HTML, icons, ROM/program files, catalog data)
- `tests/` — bun unit tests

## Generated files (gitignored)

- `src/lib/tape_catalog.ts` — file list from `static/files/`
- `src/lib/catalog_data.ts` — catalog metadata from `static/catalog/*/info.md`
- `static/radio86-emulator.js` — bundled web component

All three are auto-generated via `svelte.config.js` on every build/dev.

## Conventions

- Source of truth for programs: `static/files/` — every file must have `static/catalog/<name>/info.md`
- Imports use `.js` extension in `.ts` files (SvelteKit/Vite requirement)
- `$lib` alias points to `src/lib/`
- Debugger mode: combined view with 1:1 canvas (top-left), disassembler (right), console (below). Canvas click focuses keyboard input to emulator; clicking disassembler/console redirects input there
- Floating panels (visualizer, keyboard) are non-modal, draggable Svelte components
- Disassembler and Terminal are embedded-only (no standalone floating mode)
- Assembler is an iframe (`static/i8080asm.html`) accessing `window.parent.machine`
- `window.machine` is exposed for the assembler iframe
- UI state from engine callbacks flows through `ui_state.svelte.ts` (reactive `$state` object)
- Machine methods (`reset`, `restart`, `pause`, `loadCatalogFile`, `runLoadedFile`, `uploadFile`) are assigned in `boot.ts`
- Keyboard shortcuts: `Cmd/Ctrl+K` then a letter key (`D` for debugger, `A` for assembler, etc.)
- Icon buttons in toolbar are non-focusable (`tabindex=-1`) to prevent accidental activation via Enter/Space
- Dialogs blur active element on close to prevent focus returning to triggering button
- `BASE_PATH` env var sets deployment base path (e.g. `BASE_PATH=/alpha bun run build`)
- All text in UI is in Russian
