test: lint test-js test-i8080

lint:
    bunx eslint *.js

run:
    bun run --watch main.ts

test-watch:
    bun test --watch

test-js:
    bun test

test-i8080:
    node i8080_ex.js

test-ex1-bun:
    bun i8080_ex.js --ex1 --verbose

test-ex1-node:
    node i8080_ex.js --ex1 --verbose

test-ci: test-js test-ex1-bun test-ex1-node
