declare module "./test_load_file.js" {
    export function load_file(name: string, memory: number, tracer: number): Promise<void>;
}
