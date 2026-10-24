import { toPng } from "html-to-image";

/** Reads an image file and re-encodes it at a bounded size to keep the card light. */
export async function fileToDataUrl(file: File, maxSize: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(type, 0.85);
}

export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Resolves only if the image loads with CORS, which the PNG export requires. */
export function loadCorsImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image could not be loaded"));
    img.src = url;
  });
}

export async function renderCardPng(node: HTMLElement) {
  // Collapse editor-only elements so the measured size matches what gets exported.
  node.classList.add("exporting");
  try {
    await new Promise(requestAnimationFrame);
    return await toPng(node, { pixelRatio: 1 });
  } finally {
    node.classList.remove("exporting");
  }
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
