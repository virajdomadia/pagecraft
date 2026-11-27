import { describe, expect, it } from "vitest";
import { safeNext, slugForHost } from "@/lib/hosts";
import { slugify, slugProblem } from "@/lib/slug";
import { contrast, PALETTE_KEYS, PALETTES } from "@/lib/themes";

describe("palettes", () => {
  it.each(PALETTE_KEYS)("%s meets 4.5:1 on every pairing the sections use", (key) => {
    const p = PALETTES[key];
    for (const [fg, bg] of [
      [p.ink, p.bg],
      [p.muted, p.bg],
      [p.ink, p.surface],
      [p.muted, p.surface],
      [p.accentInk, p.accent],
      [p.accent, p.bg],
      [p.accent, p.surface],
    ])
      expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});

describe("slugs", () => {
  it("slugifies names like the API", () => {
    expect(slugify("Kaapi Corner")).toBe("kaapi-corner");
    expect(slugify("  Café — Ōno! ")).toBe("cafe-ono");
    expect(slugify("A")).toBe("a-site");
    expect(slugify("x".repeat(60))).toHaveLength(40);
  });
  it("flags reserved and malformed slugs", () => {
    expect(slugProblem("www")).toMatch(/reserved/);
    expect(slugProblem("-bad")).toMatch(/3–40/);
    expect(slugProblem("ok-slug")).toBeNull();
  });
});

describe("host → slug (middleware)", () => {
  const host = "pagecraft.virajdomadia.com";
  it("maps a site subdomain to its slug", () => {
    expect(slugForHost("kaapi-corner.pagecraft.virajdomadia.com", host)).toBe("kaapi-corner");
    expect(slugForHost("Kaapi-Corner.pagecraft.virajdomadia.com:443", host)).toBe("kaapi-corner");
  });
  it("leaves Pagecraft's own hosts and strangers alone", () => {
    for (const h of [host, "www.pagecraft.virajdomadia.com", "api.pagecraft.virajdomadia.com", "a.b.pagecraft.virajdomadia.com", "localhost:3000", "evil.com", null])
      expect(slugForHost(h, host)).toBeNull();
  });
});

describe("safeNext (sign-in redirect)", () => {
  it("keeps same-origin paths", () => {
    expect(safeNext("/sites/abc/edit?x=1#y")).toBe("/sites/abc/edit?x=1#y");
  });
  it("refuses anything that resolves off-site", () => {
    for (const n of ["//evil.example", "/\\evil.example", "/\t/evil.example","https://evil.example", "javascript:alert(1)", ""])
      expect(safeNext(n)).toBe("/sites");
  });
});
