class ConsoleTerminal extends HTMLElement {
    static HISTORY_SIZE = 100;

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    /**  @type {string[]} */
    history = [];
    historyIndex = 0;

    /**  @type {function(string): void} */
    run = (cmd) => {
        this.put(`RUN [${cmd}]`);
    };

    connectedCallback() {
        if (!this.shadowRoot) throw new Error("ConsoleTerminal: shadow DOM not supported.");
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    width: 81ch;
                    display: block;
                    font-family: monospace;
                }
                #container {
                    display: grid;
                    grid-template-rows: auto 1fr;
                }
                #output {
                    height: 30em;
                    background-color: black;
                    color: lightgreen;
                    overflow-y: auto;
                    margin-bottom: 0.5em;
                }
                #debug {
                    display: grid;
                    grid-template-columns: 1fr 10fr;
                    margin-top: 0.5em;
                }
                #history div {
                    white-space: pre-wrap;
                }
            </style>
            <div id="container">
                <div id="output"></div>
                <input type="text" id="input" />
            </div>
            <div id="debug" style="display: none;">
                <div>history</div>
                <div id="history"></div>
            </div>
        `;

        this.history = [];
        this.historyIndex = 0;
        this.HISTORY_SIZE = 100;

        this.$output = this.shadowRoot.getElementById("output");
        /** @type {!HTMLInputElement} */
        this.$input = /** @type {!HTMLInputElement} */ (this.shadowRoot.getElementById("input"));
        this.pin = this.$input;
        this.$history = this.shadowRoot.getElementById("history");

        this.$input?.focus();
        this.addListeners();

        this.history.unshift(...["ls -l", "cd /home/user", "echo 'Hello, World!'"]);
        this.printHistory();
    }

    focus() {
        this.$input?.focus();
    }

    addListeners() {
        this.$input?.addEventListener("keypress", (event) => {
            event.stopPropagation();
        });

        this.$input?.addEventListener("keydown", (event) => {
            event.stopPropagation();
            if (!this.$input) throw new Error("$input not found");
            switch (event.key) {
                case "Escape":
                    event.preventDefault();
                    this.$input.value = "";
                    break;
                case "Enter":
                    event.preventDefault();
                    const cmd = this.$input.value.trim().replace(/\n$/, "");
                    if (!cmd) return;
                    this.$input.value = "";
                    this.put(`${cmd}`);
                    this.run(cmd);

                    if (this.historyIndex === 0 && this.history[0] === cmd) return;

                    this.history.unshift(cmd);
                    if (this.history.length > ConsoleTerminal.HISTORY_SIZE) this.history.pop();
                    this.historyIndex = 0;

                    this.printHistory();
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    this.browseHistory(1);
                    break;
                case "ArrowDown":
                    event.preventDefault();
                    this.browseHistory(-1);
                    break;
            }
        });
    }

    /**
     * @param {number} direction
     */
    browseHistory(direction) {
        if (!this.$input) throw new Error("$input not found");

        if (this.$input.value.trim()) this.historyIndex += direction;
        this.historyIndex = (this.historyIndex + this.history.length) % this.history.length;

        this.$input.value = this.history[this.historyIndex];
        this.printHistory();
    }

    printHistory() {
        return;

        if (!this.$history) throw new Error("$history not found");

        this.$history.innerHTML = this.history
            .toReversed()
            .map((cmd, i) => {
                const index = this.history.length - 1 - i;
                const highlight = this.historyIndex === index ? "color: green; outline: 1px solid green;" : "";
                return `<div style="${highlight}"><b>[${index}]:</b> ${cmd}</div>`;
            })
            .join("");
    }

    /**
     * @param {string} str
     */
    put(str) {
        if (!this.$output) throw new Error("$output not found");

        const html = str.replaceAll(" ", "&nbsp;");
        this.$output.innerHTML += `<div>${html}</div>`;
        setTimeout(() => {
            if (!this.$output) throw new Error("$output not found");
            this.$output.scrollTop = this.$output.scrollHeight;
        }, 0);
    }
}

customElements.define("console-terminal", ConsoleTerminal);
