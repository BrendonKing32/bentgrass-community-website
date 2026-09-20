import { json, requireResident, text } from "../resident/_shared.js";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CATEGORIES = new Set(["events", "critters", "weather", "neighborhood"]);

export { MAX_BYTES, ALLOWED_TYPES, CATEGORIES, json, requireResident, text };

export function failClosed(reason = "The safety check could not clear this image.") {
  return { status: "specialist_review", verdict: "provider_unavailable", reason };
}

export function normalizeVerdict(data) {
  const raw = String(data?.verdict || data?.status || "").toLowerCase();
  const reference = text(data?.reference || data?.id, 200);
  if (["clear", "approved", "safe"].includes(raw)) return { status: "cleared", verdict: raw, reference };
  if (["high_risk", "csam", "illegal", "blocked"].includes(raw)) return { status: "high_risk", verdict: raw, reference };
  if (["reject", "rejected", "unsafe"].includes(raw)) return { status: "rejected", verdict: raw, reference };
  return { status: "specialist_review", verdict: raw || "uncertain", reference };
}

export async function screenImage(env, bytes, contentType) {
  if (!env.IMAGE_SAFETY_API_URL || !env.IMAGE_SAFETY_API_TOKEN) {
    return failClosed("Image safety screening is not configured.");
  }

  try {
    const response = await fetch(env.IMAGE_SAFETY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.IMAGE_SAFETY_API_TOKEN}`,
      },
      body: JSON.stringify({
        content_type: contentType,
        image_base64: arrayBufferToBase64(bytes),
        require_csam_workflow: true,
      }),
    });
    if (!response.ok) return failClosed("Image safety provider returned an error.");
    return normalizeVerdict(await response.json());
  } catch {
    return failClosed("Image safety provider was unavailable.");
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function stripMetadata(bytes, contentType) {
  const input = new Uint8Array(bytes);
  if (contentType === "image/jpeg") return stripJpegMetadata(input);
  if (contentType === "image/png") return stripPngMetadata(input);
  if (contentType === "image/webp") return stripWebpMetadata(input);
  return input;
}

function stripJpegMetadata(input) {
  if (input[0] !== 0xff || input[1] !== 0xd8) return null;
  const parts = [input.slice(0, 2)];
  let offset = 2;
  while (offset < input.length) {
    if (input[offset] !== 0xff) return null;
    const marker = input[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      parts.push(input.slice(offset));
      return concat(parts);
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(input.slice(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = (input[offset + 2] << 8) | input[offset + 3];
    if (length < 2 || offset + 2 + length > input.length) return null;
    const keep = ![0xe1, 0xe2, 0xed, 0xee, 0xfe].includes(marker);
    if (keep) parts.push(input.slice(offset, offset + 2 + length));
    offset += 2 + length;
  }
  return null;
}

function stripPngMetadata(input) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => input[index] === value)) return null;
  const parts = [input.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = new DataView(input.buffer, input.byteOffset + offset, 4).getUint32(0);
    const type = new TextDecoder().decode(input.slice(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (end > input.length) return null;
    if (!["tEXt", "zTXt", "iTXt", "eXIf"].includes(type)) parts.push(input.slice(offset, end));
    offset = end;
    if (type === "IEND") return concat(parts);
  }
  return null;
}

function stripWebpMetadata(input) {
  if (new TextDecoder().decode(input.slice(0, 4)) !== "RIFF" || new TextDecoder().decode(input.slice(8, 12)) !== "WEBP") return null;
  const parts = [input.slice(0, 12)];
  let offset = 12;
  while (offset + 8 <= input.length) {
    const type = new TextDecoder().decode(input.slice(offset, offset + 4));
    const size = new DataView(input.buffer, input.byteOffset + offset + 4, 4).getUint32(0, true);
    const end = offset + 8 + size + (size % 2);
    if (end > input.length) return null;
    if (!["EXIF", "XMP "].includes(type)) parts.push(input.slice(offset, end));
    offset = end;
  }
  const output = concat(parts);
  new DataView(output.buffer, output.byteOffset + 4, 4).setUint32(0, output.length - 8, true);
  return output;
}
