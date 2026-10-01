import { describe, expect, it } from "vitest";
import worker, { redirectLocation } from "./index.js";

describe("akaushik.dev redirect Worker", () => {
  it("preserves path and query", () => {
    expect(redirectLocation("https://akaushik.dev/about?x=1&y=a%20b")).toBe("https://akaushik.org/about?x=1&y=a%20b");
  });

  it("maps root to root", () => {
    expect(redirectLocation("https://www.akaushik.dev/")).toBe("https://akaushik.org/");
  });

  it("responds 308 with location for any method", () => {
    for (const method of ["GET", "HEAD", "POST"]) {
      const res = worker.fetch(new Request("https://akaushik.dev/a/b?c=d", { method }));
      expect(res.status).toBe(308);
      expect(res.headers.get("location")).toBe("https://akaushik.org/a/b?c=d");
    }
  });

  it("does not let the host change the target", () => {
    expect(redirectLocation("https://evil.example/x")).toBe("https://akaushik.org/x");
  });
});
