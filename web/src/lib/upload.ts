import { ApiError, toApiError, type UploadOut } from "@/lib/api";
import { tabHeaders } from "@/lib/tab-session";

export const MAX_UPLOAD = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
// Vercel functions accept request bodies up to 4.5 MB, so a 4.5–5 MB photo is shrunk in the
// browser first (the API still re-checks and resizes everything to ≤ 2000 px).
const SHRINK_OVER = 4 * 1024 * 1024;

export function uploadProblem(file: File): string | null {
  if (!TYPES.includes(file.type)) return "Upload a JPEG, PNG or WebP image";
  if (file.size > MAX_UPLOAD) return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB`;
  return null;
}

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85));
}

export async function uploadImage(siteId: string, file: File): Promise<UploadOut> {
  const problem = uploadProblem(file);
  if (problem) throw new ApiError(file.size > MAX_UPLOAD ? 413 : 415, "client", problem);
  const body = new FormData();
  body.set("site_id", siteId);
  body.set("file", file.size > SHRINK_OVER ? new File([await shrink(file)], "photo.jpg", { type: "image/jpeg" }) : file);
  let res: Response;
  try {
    res = await fetch("/api/uploads", { method: "POST", body, credentials: "same-origin", headers: tabHeaders() });
  } catch {
    throw new ApiError(0, "offline", "Upload failed — check your connection");
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as UploadOut;
}

/** "kaapi-corner_front room.jpg" → "Kaapi corner front room" (a starting point for alt text). */
export function altFromFilename(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base[0].toUpperCase() + base.slice(1, 140) : "Photo";
}
