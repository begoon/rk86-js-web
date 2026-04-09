default: test-js build

test: test-js test-i8080

build:
    bun run build

lint:
    bunx eslint *.ts

test-watch:
    bun test --watch --only-failures

test-js:
    bun test --only-failures 

test-i8080:
    bun test/i8080_ex.ts

test-ex1-bun:
    bun test/i8080_ex.ts --ex1 --verbose

test-ex1-node:
    bunx tsx test/i8080_ex.ts --ex1 --verbose

test-ci: test-js test-ex1-bun

release-alpha:
    BASE_PATH=/alpha bun run build 
    cp -R ./build/* ../rk86-js/docs/alpha/ 

release-beta:
    BASE_PATH=/beta bun run build 
    cp -R ./build/* ../rk86-js/docs/beta/

release: release-beta release-alpha

terminal *args='':
    bun src/lib/rk86_terminal.ts {{args}}
