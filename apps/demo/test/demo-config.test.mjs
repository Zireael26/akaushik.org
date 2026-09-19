/**
 * (d) DEMO_SUGGESTIONS parsing never throws and env getters fail closed.
 *
 * Covers lib/demo-config.ts::parseSuggestions plus the branding/VeriCite
 * getters. Fixture chips are invented ("Acme Tower" / "Widget Corp").
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  getDemoSubtitle,
  getDemoTitle,
  getSuggestions,
  getVericiteApiBase,
  getVericiteChannelId,
  getVericiteMaxSources,
  parseSuggestions,
} from "../lib/demo-config.ts";

test("invalid JSON returns null without throwing", () => {
  assert.equal(parseSuggestions("{not json"), null);
  assert.equal(parseSuggestions("["), null);
  assert.equal(parseSuggestions("undefined"), null);
});

test("non-arrays and empty arrays return null", () => {
  assert.equal(parseSuggestions('{"a":1}'), null);
  assert.equal(parseSuggestions('"hello"'), null);
  assert.equal(parseSuggestions("[]"), null);
  assert.equal(parseSuggestions(""), null);
  assert.equal(parseSuggestions("   "), null);
  assert.equal(parseSuggestions(null), null);
  assert.equal(parseSuggestions(undefined), null);
  assert.equal(parseSuggestions(42), null);
});

test("valid arrays return trimmed non-empty strings, capped", () => {
  assert.deepEqual(
    parseSuggestions('["Tell me about Acme Tower", "  ", "Widget Corp overview"]'),
    ["Tell me about Acme Tower", "Widget Corp overview"],
  );
  assert.deepEqual(parseSuggestions('[1, null, "Widget Corp"]'), ["Widget Corp"]);
  const many = JSON.stringify(Array.from({ length: 20 }, (_, i) => `Acme Tower ${i}`));
  const parsed = parseSuggestions(many);
  assert.equal(parsed?.length, 12, "suggestions are capped at 12");
});

test("getSuggestions reads the env binding", () => {
  assert.deepEqual(getSuggestions({ DEMO_SUGGESTIONS: '["Acme Tower"]' }), ["Acme Tower"]);
  assert.equal(getSuggestions({}), null);
  assert.equal(getSuggestions({ DEMO_SUGGESTIONS: "{bad" }), null);
});

test("env getters fail closed to safe defaults", () => {
  assert.equal(getDemoTitle({}), "Demo");
  assert.equal(getDemoTitle({ DEMO_TITLE: "  " }), "Demo");
  assert.equal(getDemoTitle({ DEMO_TITLE: "Acme Tower demo" }), "Acme Tower demo");
  assert.equal(getDemoSubtitle({}), "A private demonstration");
  assert.equal(getVericiteApiBase({}), "https://api.vericite.ai");
  assert.equal(getVericiteApiBase({ VERICITE_API_BASE: "https://x.invalid/" }), "https://x.invalid");
  assert.equal(getVericiteChannelId({}), "");
  assert.equal(getVericiteMaxSources({}), 5);
  assert.equal(getVericiteMaxSources({ VERICITE_MAX_SOURCES: "bogus" }), 5);
  assert.equal(getVericiteMaxSources({ VERICITE_MAX_SOURCES: "999" }), 10);
});
