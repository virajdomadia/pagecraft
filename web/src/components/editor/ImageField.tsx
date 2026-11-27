"use client";

import { useRef, useState } from "react";
import { errorMessage } from "@/lib/api";
import { PHOTO_LIBRARY } from "@/lib/photo-library";
import { altFromFilename, uploadImage } from "@/lib/upload";

/**
 * An image field (S7): drag-drop or pick a file → `POST /uploads` → `{ url, alt }` into the doc;
 * or choose from the template photo library; alt text alongside (required to publish).
 */
export function ImageField({
  siteId,
  label,
  url,
  alt,
  onChange,
  compact,
}: {
  siteId: string;
  label: string;
  url: string;
  alt: string;
  onChange: (next: { url: string; alt: string }) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);
  const [over, setOver] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await uploadImage(siteId, file);
      // A new photo gets a fresh starting alt (the old one described a different picture).
      onChange({ url: res.url, alt: altFromFilename(file.name) });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <span className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</span>
      <div
        className={`relative grid overflow-hidden rounded-[3px] border ${over ? "border-guide bg-guide-soft" : "border-line bg-desk"} ${compact ? "grid-cols-[72px_1fr]" : "grid-cols-[96px_1fr]"} items-center gap-3 p-2`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files[0]);
        }}
      >
        <div className="aspect-[4/3] overflow-hidden rounded-[2px] bg-paper">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center font-mono text-xs text-muted">no image</div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="rounded-[3px] bg-ink px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-guide disabled:opacity-60"
          >
            {busy ? "Uploading…" : url ? "Replace" : "Upload"}
          </button>
          <button
            type="button"
            onClick={() => setLibrary((l) => !l)}
            aria-expanded={library}
            className="rounded-[3px] border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold hover:border-guide"
          >
            Library
          </button>
          {url && (
            <button type="button" onClick={() => onChange({ url: "", alt: "" })} className="rounded-[3px] px-2 py-1.5 text-xs font-semibold text-coral-ink hover:bg-coral/10">
              Remove
            </button>
          )}
          <span className="w-full text-xs text-ink-2">JPEG, PNG or WebP · up to 5 MB · or drop a file here</span>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label={`Upload ${label}`}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-coral-ink">
          {error}
        </p>
      )}
      {library && (
        <ul className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto rounded-[3px] border border-line bg-paper p-1.5">
          {PHOTO_LIBRARY.map((p) => (
            <li key={p.url}>
              <button
                type="button"
                onClick={() => {
                  onChange({ url: p.url, alt: p.alt });
                  setLibrary(false);
                }}
                className={`block aspect-square w-full overflow-hidden rounded-[2px] border-2 ${p.url === url ? "border-guide" : "border-transparent hover:border-guide/60"}`}
                aria-label={`Use photo: ${p.alt}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {url && (
        <label className="block">
          <span className="font-mono text-xs text-muted">Alt text: describe the photo for screen readers</span>
          <input
            className="mt-1 block w-full rounded-[3px] border border-line bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-guide"
            value={alt}
            maxLength={140}
            onChange={(e) => onChange({ url, alt: e.target.value })}
            aria-invalid={!alt.trim()}
          />
          {!alt.trim() && <span className="mt-1 block text-xs text-coral-ink">Needed before you publish.</span>}
        </label>
      )}
    </div>
  );
}
