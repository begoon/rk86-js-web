default: test-js build

test: test-js test-i8080

build:
    bun build --compile --target=browser --outfile=index.html main.html

lint:
    bunx eslint *.ts

run: build
    bun run --watch server.ts

test-watch:
    bun test --watch --only-failures

test-js:
    bun test --only-failures 

test-i8080:
    bun i8080_ex.ts

test-ex1-bun:
    bun i8080_ex.ts --ex1 --verbose

test-ex1-node:
    node i8080_ex.ts --ex1 --verbose

test-ci: test-js test-ex1-bun test-ex1-node
