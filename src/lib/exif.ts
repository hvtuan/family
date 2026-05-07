/**
 * Image processing pipeline for media v2.
 *
 *   processImage(file) → { original, medium, thumb, width, height, ... }
 *
 * - Strips ALL EXIF (GPS, camera serial, timestamps) on every variant.
 * - Auto-orients via the EXIF orientation tag before stripping (so
 *   iPhone portrait shots don't end up sideways).
 * - Generates two webp variants (medium 800w, thumb 320w) plus a copy
 *   of the original in the original format.
 * - SVG and GIF are passed through unchanged for variants too — the
 *   former is vector, the latter is animated and would lose frames.
 * - HEIC (iPhone iCloud) is converted to JPEG via lazy-loaded
 *   `heic-convert` before processing.
 */
import sharp from "sharp";

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/heic",
  "image/heif",
]);

export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export type ProcessedImage = {
  /** Bytes for original.<ext>, EXIF-stripped, format unchanged. */
  original: Buffer;
  /** Bytes for medium.webp (800w) or null if input is svg/gif. */
  medium: Buffer | null;
  /** Bytes for thumb.webp (320w) or null if input is svg/gif. */
  thumb: Buffer | null;
  width: number;
  height: number;
  bytes: number;
  /** Final mime AFTER any HEIC→JPEG conversion. */
  mime: string;
  /** File extension to use for original.<ext>. */
  ext: string;
};

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/** Detect HEIC by mime OR extension (browsers often report octet-stream). */
function isHeic(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}

/** Lazy-load heic-convert only when needed (it pulls a wasm blob). */
async function convertHeic(file: File): Promise<File> {
  // Dynamic import keeps it out of the cold-start bundle for the 99%
  // case where the upload isn't HEIC.
  const mod = await import("heic-convert").catch(() => null);
  if (!mod) {
    throw new Error(
      "Ảnh HEIC từ iPhone chưa được hỗ trợ trên server này. Hãy đổi sang JPG trước khi tải lên.",
    );
  }
  const heicConvert = (mod as { default: typeof import("heic-convert") }).default;
  const buf = await file.arrayBuffer();
  const jpgBuf = await heicConvert({ buffer: buf, format: "JPEG", quality: 0.9 });
  const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([jpgBuf], newName, { type: "image/jpeg" });
}

export async function convertHeicIfNeeded(file: File): Promise<File> {
  return isHeic(file) ? convertHeic(file) : file;
}

/** Single source of truth for input validation. Throws Vietnamese error. */
function validate(file: File): void {
  if (!ALLOWED_MIME.has(file.type) && !isHeic(file)) {
    throw new Error(
      `Định dạng ${file.type || "không xác định"} không hỗ trợ. Dùng JPG, PNG, WebP, GIF, SVG hoặc HEIC.`,
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `File ${(file.size / 1024 / 1024).toFixed(1)} MB vượt giới hạn ${MAX_BYTES / 1024 / 1024} MB.`,
    );
  }
}

/**
 * Process an uploaded file into the 3 variants we store. The caller
 * uploads each Buffer to its respective Storage path.
 *
 * For SVG and GIF (where resizing/transcoding loses fidelity) we set
 * `medium` and `thumb` to null and the caller stores the same path
 * for all three references. Width/height are inferred via sharp where
 * possible; SVG falls back to (0, 0).
 */
export async function processImage(input: File): Promise<ProcessedImage> {
  validate(input);
  const file = await convertHeicIfNeeded(input);

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const ext = MIME_TO_EXT[mime] ?? "bin";

  // SVG: pass-through. Sharp can read SVG metadata but rasterizing
  // breaks the use-case (vector logos, family crests).
  if (mime === "image/svg+xml") {
    return {
      original: buf,
      medium: null,
      thumb: null,
      width: 0,
      height: 0,
      bytes: buf.byteLength,
      mime,
      ext,
    };
  }

  // GIF: pass-through to keep animation frames intact. Sharp's
  // `animated: true` works but we don't need it for static thumbs;
  // showing the first frame as the thumb would surprise users.
  if (mime === "image/gif") {
    const meta = await sharp(buf).metadata();
    return {
      original: buf,
      medium: null,
      thumb: null,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      bytes: buf.byteLength,
      mime,
      ext,
    };
  }

  // Raster path: auto-orient → 3 outputs in parallel. Sharp's default
  // behaviour is to STRIP all EXIF/IPTC/XMP/ICC metadata; we never call
  // .keepMetadata() / .withMetadata() so GPS, camera serial, and
  // timestamps don't leak through to the public site.
  const oriented = sharp(buf).rotate();
  const meta = await oriented.metadata();

  const [original, medium, thumb] = await Promise.all([
    oriented.clone().toBuffer(),
    oriented
      .clone()
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer(),
    oriented
      .clone()
      .resize({ width: 320, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
  ]);

  return {
    original,
    medium,
    thumb,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    bytes: original.byteLength,
    mime,
    ext,
  };
}

/** Map the input mime to the file extension used for the original blob. */
export function extForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? "bin";
}
