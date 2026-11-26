"use client";

import { useEffect, useState } from "react";
import { api, type SlugCheck } from "@/lib/api";
import { slugProblem } from "@/lib/slug";

export type SlugState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok" }
  | { state: "bad"; message: string; suggestion: string | null };

/** Live address check (R2): instant local rules, then the API's verdict after 300 ms. */
export function useSlugCheck(slug: string, opts: { siteId?: string; current?: string } = {}): SlugState {
  const [result, setResult] = useState<SlugState>({ state: "idle" });
  const { siteId, current } = opts;

  useEffect(() => {
    if (!slug) {
      setResult({ state: "idle" });
      return;
    }
    if (current && slug === current) {
      setResult({ state: "ok" });
      return;
    }
    const local = slugProblem(slug);
    if (local) {
      setResult({ state: "bad", message: local, suggestion: null });
      return;
    }
    setResult({ state: "checking" });
    let live = true;
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ slug, ...(siteId ? { site_id: siteId } : {}) });
        const res = await api<SlugCheck>(`/sites/slug-check?${q}`);
        if (!live) return;
        setResult(res.available ? { state: "ok" } : { state: "bad", message: res.message, suggestion: res.suggestion ?? null });
      } catch {
        if (live) setResult({ state: "idle" });
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [slug, siteId, current]);

  return result;
}
