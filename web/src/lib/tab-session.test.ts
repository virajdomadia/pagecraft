// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { adoptTabSession, TAB_HEADER, tabHeaders } from "@/lib/tab-session";

describe("tab session (open as teammate)", () => {
  it("takes the token from the fragment into this tab only and clears the address bar", () => {
    expect(tabHeaders()).toEqual({});
    window.history.replaceState(null, "", "/sites/x/edit#teammate=abc_DEF-123");
    adoptTabSession();
    expect(window.location.hash).toBe("");
    expect(tabHeaders()).toEqual({ [TAB_HEADER]: "abc_DEF-123" });
    window.history.replaceState(null, "", "/sites/x/edit#teammate=<script>");
    adoptTabSession(); // not a token: ignored
    expect(tabHeaders()).toEqual({ [TAB_HEADER]: "abc_DEF-123" });
  });
});
