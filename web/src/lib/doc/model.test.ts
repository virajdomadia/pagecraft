import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { replaceContent } from "@/lib/doc/ops";
import { buildDoc, exportDoc, getAt, LOAD, LOCAL, replaceText, roots, setField, shiftIndex, type SiteContent, withFreshIds } from "@/lib/doc/model";

const content: SiteContent = {
  site: {
    name: "Kaapi Corner",
    theme: { palette: "espresso", fonts: "fraunces-inter", radius: "soft" },
    seo: { title: "Kaapi Corner", description: "Filter coffee", og_image: "" },
  },
  sections: [
    {
      id: "s_hero01",
      type: "hero",
      variant: "split",
      props: {
        headline: "Filter coffee, done properly.",
        image: { url: "/templates/cafe/hero.jpg", alt: "A tumbler" },
        items: [{ id: "i_1", title: "Idli" }],
      },
    },
  ],
};

describe("the document model", () => {
  it("round-trips JSON through a Y.Doc, with typed text as Y.Text and enums as plain values", () => {
    const doc = buildDoc(content);
    expect(exportDoc(doc)).toEqual(content);
    const { site, sections } = roots(doc);
    expect(getAt(site, ["seo", "title"])).toBeInstanceOf(Y.Text);
    expect(getAt(site, ["theme", "palette"])).toBe("espresso");
    const props = sections.get(0).get("props") as Y.Map<unknown>;
    expect(getAt(props, ["headline"])).toBeInstanceOf(Y.Text);
    expect(getAt(props, ["image", "url"])).toBe("/templates/cafe/hero.jpg");
    expect(getAt(props, ["items", 0, "title"])).toBeInstanceOf(Y.Text);
  });

  it("survives encode → decode like the API's snapshot", () => {
    const update = Y.encodeStateAsUpdate(buildDoc(content));
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);
    expect(exportDoc(doc)).toEqual(content);
  });

  it("replaceText makes the smallest edit, so a concurrent edit elsewhere survives", () => {
    const a = buildDoc(content);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const headline = (d: Y.Doc) => getAt(roots(d).sections.get(0).get("props") as Y.Map<unknown>, ["headline"]) as Y.Text;

    replaceText(headline(a), "Filter coffee, done really properly.");
    headline(b).insert(0, "Hot ");
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(headline(a).toString()).toBe("Hot Filter coffee, done really properly.");
    expect(headline(b).toString()).toBe(headline(a).toString());
  });

  it("two inserts at the same offset converge in either order (CRDT)", () => {
    const base = Y.encodeStateAsUpdate(buildDoc(content));
    const [a, b] = [new Y.Doc(), new Y.Doc()];
    Y.applyUpdate(a, base);
    Y.applyUpdate(b, base);
    const h = (d: Y.Doc) => getAt(roots(d).sections.get(0).get("props") as Y.Map<unknown>, ["headline"]) as Y.Text;
    h(a).insert(7, "BRASS ");
    h(b).insert(7, "steel ");
    const ua = Y.encodeStateAsUpdate(a);
    const ub = Y.encodeStateAsUpdate(b);
    Y.applyUpdate(a, ub);
    Y.applyUpdate(b, ua);
    expect(h(a).toString()).toBe(h(b).toString());
    expect(h(a).toString()).toContain("BRASS ");
    expect(h(a).toString()).toContain("steel ");
  });

  it("setField edits text in place and sets atomic values", () => {
    const doc = buildDoc(content);
    const props = roots(doc).sections.get(0).get("props") as Y.Map<unknown>;
    const before = getAt(props, ["headline"]);
    doc.transact(() => {
      setField(props, "headline", "New headline");
      setField(getAt(props, ["image"]) as Y.Map<unknown>, "url", "/templates/cafe/latte.jpg");
    }, LOCAL);
    expect(getAt(props, ["headline"])).toBe(before);
    expect(exportDoc(doc).sections[0].props).toMatchObject({
      headline: "New headline",
      image: { url: "/templates/cafe/latte.jpg" },
    });
  });

  it("undo restores a deleted section", () => {
    const doc = buildDoc(content);
    const { site, sections } = roots(doc);
    const undo = new Y.UndoManager([site, sections], { trackedOrigins: new Set([LOCAL]) });
    doc.transact(() => sections.delete(0, 1), LOCAL);
    expect(sections.length).toBe(0);
    undo.undo();
    expect(exportDoc(doc)).toEqual(content);
  });

  it("duplicating gives the section and every list item a fresh id", () => {
    const copy = withFreshIds(content.sections[0]);
    expect(copy.id).not.toBe("s_hero01");
    expect(copy.id).toMatch(/^s_[a-z0-9]{6}$/);
    expect((copy.props.items as { id: string }[])[0].id).not.toBe("i_1");
    expect(copy.props.headline).toBe("Filter coffee, done properly.");
  });

  it("shiftIndex keeps a caret on its character when a teammate edits elsewhere in the text", () => {
    const a = new Y.Doc();
    const text = a.getText("t");
    text.insert(0, "Filter coffee");
    const caret = 6; // after "Filter"
    let seen = caret;
    text.observe((e) => {
      seen = shiftIndex(e.delta, seen);
    });
    const remote = (fn: () => void) => a.transact(fn, LOAD);
    remote(() => text.insert(0, "Good "));
    expect(text.toString().slice(0, seen)).toBe("Good Filter");
    remote(() => text.insert(text.length, "!"));
    expect(seen).toBe(11);
    remote(() => text.delete(0, 5));
    expect(text.toString().slice(0, seen)).toBe("Filter");
    remote(() => text.delete(3, 6)); // a deletion across the caret lands it at the cut
    expect(seen).toBe(3);
  });

  it("replaceContent restores a version exactly, syncs as an update, and one undo brings the edit back", () => {
    const doc = buildDoc(content);
    const r = roots(doc);
    const undo = new Y.UndoManager([r.site, r.sections], { trackedOrigins: new Set([LOCAL]) });
    const edited: SiteContent = {
      ...content,
      site: { ...content.site, name: "Kaapi Corner 2", extra: "x" },
      sections: [{ ...content.sections[0], props: { ...content.sections[0].props, headline: "New" } }, { id: "s_new001", type: "cta", variant: "band", props: {} }],
    };
    doc.transact(() => replaceContent(r, edited), LOCAL);
    expect(exportDoc(doc)).toEqual(edited);

    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc));
    undo.stopCapturing();
    doc.transact(() => replaceContent(r, content), LOCAL);
    expect(exportDoc(doc)).toEqual(content);
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc));
    expect(exportDoc(peer)).toEqual(content);

    undo.undo();
    expect(exportDoc(doc)).toEqual(edited);
  });
});

