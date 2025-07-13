function createButton(labels) {
    const element = document.createElement("button");
    labels.forEach((label) => {
        const div = document.createElement("div");
        div.innerHTML = label ? label : "&nbsp;";
        element.appendChild(div);
    });
    return element;
}

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

export default function create() {
    const keyboardMain = document.getElementById("keyboard-main");
    keyboardLayout.forEach((row, index) => {
        const rowElement = document.createElement("div");
        if (index % 2 === 1) rowElement.style.marginLeft = "2em";
        rowElement.className = "keyboard-row";
        keyboardMain.appendChild(rowElement);

        row.forEach((labels) => rowElement.appendChild(createButton(labels)));
    });

    const keyboardPad = document.getElementById("keyboard-pad");
    padLayout.forEach((labels, i) => {
        const button = createButton(labels);
        button.style.width = "3em";
        button.style.margin = "0";
        button.style.padding = "0";
        if (i === 9) {
            button.style.width = "6em";
            button.style.gridColumn = "span 2";
        }
        keyboardPad.appendChild(button);
    });
}

export function main() {
    create();
}
