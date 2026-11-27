// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { adoptTabSession, TAB_HEADER, tabHeaders } from "@/lib/tab-session";

describe("tab session (open as teammate)", () => {
  it("takes the token from the fragment into this tab's editor of that site only", () => {
    expect(tabHeaders()).toEqual({});
    window.history.replaceState(null, "", "/sites/s1/edit#teammate=abc_DEF-123");
    adoptTabSession();
    expect(window.location.hash).toBe("");
    expect(tabHeaders()).toEqual({ [TAB_HEADER]: "abc_DEF-123" });

    window.history.replaceState(null, "", "/sites/s1/edit#teammate=<script>");
    adoptTabSession(); // not a token: ignored
    expect(tabHeaders()).toEqual({ [TAB_HEADER]: "abc_DEF-123" });

    // Elsewhere the tab is the cookie's user again.
    window.history.replaceState(null, "", "/sites");
    expect(tabHeaders()).toEqual({});
    window.history.replaceState(null, "", "/sites/s2/edit");
    expect(tabHeaders()).toEqual({});
  });
});
