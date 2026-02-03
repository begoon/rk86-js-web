export {};

declare global {
    interface String {
        /**
         * Replaces {0}, {1}, ... with the corresponding arguments.
         * Example: "Hello {0}".format("world") -> "Hello world"
         */
        format(...args: unknown[]): string;
    }
}
