// Reactive bridge between imperative engine code and Svelte components.
// Engine writes here via callbacks, Svelte reads reactively.

export const ui = $state({
    tapeActivityActive: false,
    tapeWrittenBytes: 0,
    tapeHighlight: false,
    rusLat: false,
    videoMemoryBase: 0,
    screenWidth: 0,
    screenHeight: 0,
    ips: 0,
    tps: 0,
    selectedFileName: "",
    visualizerOpcode: -1,
    selectedFileStart: 0,
    selectedFileEnd: 0,
    selectedFileSize: 0,
    selectedFileEntry: 0,
});
