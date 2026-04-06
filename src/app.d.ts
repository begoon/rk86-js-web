// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Machine } from "$lib/rk86_machine";

declare global {
	interface Window {
		machine?: Machine;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
