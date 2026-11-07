// Page images. Photos are shrunk in the browser first, because the website's host
// refuses requests over 4.5 MB and phone photos are often larger. The API then checks
// and saves its own clean copy, so nothing here is relied on for safety.
import { pageSchema } from "./pageContent.mjs";

export const IMAGE_TYPES = "image/jpeg,image/png,image/webp";
export const MAX_UPLOAD_BYTES = 4_000_000;
const JPEG_QUALITY = 0.88;

const UNREADABLE = "This photo couldn't be opened. Please choose a JPG, PNG or WebP photo.";
const TOO_LARGE = "This photo is too large. Please use a smaller one.";

export function imageSpec(kind, page, key) {
  const sections = pageSchema[kind] && Object.hasOwn(pageSchema[kind], page) ? pageSchema[kind][page].sections : [];
  const spec = sections.flatMap((section) => section.fields).find((field) => field.key === key);
  return spec?.type === "image" ? spec : undefined;
}

export function fitWithin(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function imageFailure(status, data) {
  if (status === 401) return { signedOut: true };
  if (status === 403) return { error: "You can't edit this page." };
  if (status === 400 && data?.image?.length) return { error: data.image.join(" ") };
  return { error: "The photo couldn't be saved right now. Please try again in a moment." };
}

// In the browser: a smaller copy of the chosen file. Throws an Error with a message to show.
export async function shrinkImage(file, { max_side: maxSide, transparent }) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(UNREADABLE);
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  if (!transparent) {
    // A JPEG can't be see-through, and would turn clear areas black.
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, transparent ? "image/png" : "image/jpeg", JPEG_QUALITY);
  });
  if (!blob) throw new Error(UNREADABLE);
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error(TOO_LARGE);
  return blob;
}
