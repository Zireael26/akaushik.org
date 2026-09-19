/**
 * Registers the test-only module resolution hook (see ./hooks.mjs).
 * Loaded via `node --test --import ./test/support/register.mjs` before any
 * test file, so the hook applies to the whole suite.
 */
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
