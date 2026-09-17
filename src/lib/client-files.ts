"use client";

const MAX_IMAGE_EDGE = 1280;
const SMALL_IMAGE_BYTES = 1_500_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

async function downscaleImage(file: File): Promise<File> {
  const img = await loadImage(file);
  const longestEdge = Math.max(img.naturalWidth, img.naturalHeight);
  if (longestEdge <= MAX_IMAGE_EDGE && file.size <= SMALL_IMAGE_BYTES) {
    return file;
  }

  const scale = Math.min(1, MAX_IMAGE_EDGE / longestEdge);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const mime = file.type === "image/png" ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, 0.82)
  );
  if (!blob || blob.size >= file.size) return file;

  const extension = mime === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${extension}`, {
    type: mime,
    lastModified: file.lastModified,
  });
}

/**
 * Compresses phone-sized photos before they are sent to the model, so the
 * request stays well under Vercel's ~4.5 MB body limit and the free model
 * does not waste tokens on surplus resolution. Small images pass through
 * untouched.
 */
export async function prepareFilesForSend(files: File[]): Promise<File[]> {
  const prepared: File[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      prepared.push(file);
      continue;
    }
    try {
      prepared.push(await downscaleImage(file));
    } catch {
      prepared.push(file);
    }
  }
  return prepared;
}