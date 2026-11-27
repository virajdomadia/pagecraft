"use client";

import { type ElementType, useLayoutEffect, useRef } from "react";
import * as Y from "yjs";
import { LOAD, LOCAL, replaceText, shiftIndex } from "@/lib/doc/model";

/**
 * Inline text editing (R3, 04 §3): a `contentEditable` element bound to one Y.Text. Plain text
 * and line breaks only — no HTML ever enters the document.
 *
 * DOM → Y: on `input`, diff the element's text against the Y.Text and apply the minimal
 * insert/delete (so a concurrent edit elsewhere in the same text survives). Enter and paste are
 * handled here, not by the browser, so every engine produces the same `\n`.
 * Y → DOM: when the Y.Text changes for any other reason (undo, redo, a teammate in v2), the
 * element is rewritten and the caret placed where the change happened.
 */

function caretOffsets(el: HTMLElement): [number, number] | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return null;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return [start, start + range.toString().length];
}

function placeCaret(el: HTMLElement, offset: number, end = offset): void {
  const node = el.firstChild ?? el;
  const len = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? "").length : 0;
  const range = document.createRange();
  range.setStart(node, Math.min(offset, len));
  range.setEnd(node, Math.min(end, len));
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Where a remote / undo change ended, from a Y.Text event delta. */
function caretAfter(delta: Y.YTextEvent["delta"]): number {
  let pos = 0;
  let caret = 0;
  for (const op of delta) {
    if (op.retain) pos += op.retain;
    if (typeof op.insert === "string") {
      pos += op.insert.length;
      caret = pos;
    }
    if (op.delete) caret = pos;
  }
  return caret;
}

export function Editable({
  text,
  as: Tag = "span",
  className = "",
  multiline = false,
  placeholder = "Type here",
  max,
  label,
}: {
  text: Y.Text;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  max?: number;
  label?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const value = text.toString();
    if (el.textContent !== value) el.textContent = value;
    const observer = (event: Y.YTextEvent) => {
      const next = text.toString();
      if (el.textContent === next) return;
      const focused = document.activeElement === el;
      // A teammate's edit keeps your caret on its character; undo / redo jump to the change.
      const remote = event.transaction.origin === LOAD;
      const mine = focused && remote ? caretOffsets(el) : null;
      el.textContent = next;
      if (mine) placeCaret(el, shiftIndex(event.delta, mine[0]), shiftIndex(event.delta, mine[1]));
      else if (focused && !remote) placeCaret(el, caretAfter(event.delta));
    };
    text.observe(observer);
    return () => text.unobserve(observer);
  }, [text]);

  const doc = () => text.doc;
  const limit = max ?? Infinity;

  function replaceRange(start: number, end: number, insert: string) {
    const current = text.toString();
    const room = limit - (current.length - (end - start));
    const piece = insert.slice(0, Math.max(0, room));
    doc()?.transact(() => {
      if (end > start) text.delete(start, end - start);
      if (piece) text.insert(start, piece);
    }, LOCAL);
    const el = ref.current;
    if (el) placeCaret(el, start + piece.length);
  }

  return (
    <Tag
      ref={ref}
      className={`pc-editable ${className}`}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      aria-label={label ?? placeholder}
      data-placeholder={placeholder}
      spellCheck
      onInput={(e: React.FormEvent<HTMLElement>) => {
        const el = e.currentTarget;
        let next = (el.textContent ?? "").replace(/\r/g, "");
        if (!multiline) next = next.replace(/\n/g, " ");
        if (next === "") el.textContent = ""; // drop the <br> some engines leave, so :empty works
        if (next.length > limit) {
          const at = caretOffsets(el)?.[0] ?? 0;
          el.textContent = text.toString();
          placeCaret(el, Math.max(0, at - (next.length - limit)));
          el.dataset.limit = "1";
          setTimeout(() => delete el.dataset.limit, 600);
          return;
        }
        doc()?.transact(() => replaceText(text, next), LOCAL);
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!multiline) {
            e.currentTarget.blur();
            return;
          }
          const at = caretOffsets(e.currentTarget);
          if (at) replaceRange(at[0], at[1], "\n");
        }
        if (e.key === "Escape") e.currentTarget.blur();
      }}
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        e.preventDefault();
        let pasted = e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
        if (!multiline) pasted = pasted.replace(/\s*\n\s*/g, " ");
        const at = caretOffsets(e.currentTarget);
        if (at) replaceRange(at[0], at[1], pasted);
      }}
      onDrop={(e: React.DragEvent<HTMLElement>) => e.preventDefault()}
    />
  );
}
