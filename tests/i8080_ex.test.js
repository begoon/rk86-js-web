import { expect, test } from "bun:test";

import { executor } from "../test_executor.js";

test("TEST.COM", async () => {
    const { success, output } = await executor("TEST.COM", true, 2);
    expect(output).toEqual([
        "> LOAD TEST.COM 1793",
        "OUTPUT: MICROCOSM ASSOCIATES 8080/8085 CPU DIAGNOSTIC VERSION 1.0  (C) 1980",
        "OUTPUT: ",
        "OUTPUT: CPU IS OPERATIONAL",
        "Jump to 0000 from 14f",
    ]);
    expect(success).toBeTrue();
});

test("CPUTEST.COM", async () => {
    const { success, output } = await executor("CPUTEST.COM", true, 120);
    expect(output).toEqual([
        "> LOAD CPUTEST.COM 19200",
        "OUTPUT: <00><00><00><00><00><00>",
        "OUTPUT: DIAGNOSTICS II V1.2 - CPU TEST",
        "OUTPUT: COPYRIGHT (C) 1981 - SUPERSOFT ASSOCIATES",
        "OUTPUT: ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "OUTPUT: CPU IS 8080/8085",
        "OUTPUT: BEGIN TIMING TEST",
        "OUTPUT: <07><07>END TIMING TEST",
        "OUTPUT: CPU TESTS OK",
        "OUTPUT: ",
        "Jump to 0000 from 3b25",
    ]);
    expect(success).toBeTrue();
});

test("8080PRE.COM", async () => {
    const { success, output } = await executor("8080PRE.COM", true, 5);
    expect(output).toEqual([
        "> LOAD 8080PRE.COM 1024",
        "OUTPUT: 8080 Preliminary tests complete",
        "Jump to 0000 from 32f",
    ]);
    expect(success).toBeTrue();
});
