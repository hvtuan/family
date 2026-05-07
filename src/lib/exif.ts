/**
 * Media processing pipeline (image + video) for media v2.
 *
 *   processMedia(file) → {
 *     kind: 'image' | 'video',
 *     original, medium, thumb,
 *     width, height, bytes, mime, ext,
 *   }
 *
 * Image path: sharp().rotate() → 3 outputs (original/medium 800w/thumb
 * 320w). Default sharp behaviour STRIPS all EXIF/IPTC/XMP. SVG and GIF
 * pass through unchanged. HEIC converts via lazy heic-convert first.
 *
 * Video path: NO server-side transcoding. Validates MIME + size only.
 * Returns just the original buffer + ext + mime; caller is responsible
 * for supplying a poster image (extracted client-side from a <video>
 * element) which it routes through processImage() separately.
 */
import sharp from "sharp";

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/heic",
  "image/heif",
]);

export const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

/** Backward-compat alias used by older callers. */
export const ALLOWED_MIME = ALLOWED_IMAGE_MIME;

export const MAX_BYTES_IMAGE = 25 * 1024 * 1024;   // 25 MB
export const MAX_BYTES_VIDEO = 200 * 1024 * 1024;  // 200 MB

/** Backward-compat alias. */
export const MAX_BYTES = MAX_BYTES_IMAGE;

export type MediaKind = "image" | "video";

export type ProcessedMedia = {
  kind: MediaKind;
  original: Buffer;
  /** Bytes for medium.webp (800w). null for video / svg / gif. */
  medium: Buffer | null;
  /** Bytes for thumb.webp (320w). null for video / svg / gif. */
  thumb: Buffer | null;
  width: number;
  height: number;
  bytes: number;
  mime: string;
  ext: string;
};

/** Backward-compat alias for older imports. */
export type ProcessedImage = ProcessedMedia;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function isHeic(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}

function isVideo(file: File): boolean {
  if (ALLOWED_VIDEO_MIME.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

async function convertHeic(file: File): Promise<File> {
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

export function detectKind(file: File): MediaKind {
  return isVideo(file) ? "video" : "image";
}

function validate(file: File, kind: MediaKind): void {
  if (kind === "video") {
    if (!ALLOWED_VIDEO_MIME.has(file.type) && !isVideo(file)) {
      throw new Error(
        `Định dạng video ${file.type || "không xác định"} không hỗ trợ. Dùng MP4, WebM hoặc MOV.`,
      );
    }
    if (file.size > MAX_BYTES_VIDEO) {
      throw new Error(
        `Video ${(file.size / 1024 / 1024).toFixed(1)} MB vượt giới hạn ${MAX_BYTES_VIDEO / 1024 / 1024} MB.`,
      );
    }
    return;
  }
  if (!ALLOWED_IMAGE_MIME.has(file.type) && !isHeic(file)) {
    throw new Error(
      `Định dạng ${file.type || "không xác định"} không hỗ trợ. Dùng JPG, PNG, WebP, GIF, SVG, HEIC, MP4, WebM hoặc MOV.`,
    );
  }
  if (file.size > MAX_BYTES_IMAGE) {
    throw new Error(
      `File ${(file.size / 1024 / 1024).toFixed(1)} MB vượt giới hạn ${MAX_BYTES_IMAGE / 1024 / 1024} MB.`,
    );
  }
}

/**
 * Route image vs video. Caller decides what to upload from the result.
 * For video, `medium` and `thumb` are always null — caller must run a
 * separately-supplied poster file through processImage() to fill them.
 */
export async function processMedia(input: File): Promise<ProcessedMedia> {
  const kind = detectKind(input);
  validate(input, kind);

  if (kind === "video") {
    const buf = Buffer.from(await input.arrayBuffer());
    return {
      kind: "video",
      original: buf,
      medium: null,
      thumb: null,
      width: 0,
      height: 0,
      bytes: buf.byteLength,
      mime: input.type || "video/mp4",
      ext: MIME_TO_EXT[input.type] ?? input.name.split(".").pop()?.toLowerCase() ?? "mp4",
    };
  }

  return processImage(input);
}

export async function processImage(input: File): Promise<ProcessedMedia> {
  validate(input, "image");
  const file = await convertHeicIfNeeded(input);

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const ext = MIME_TO_EXT[mime] ?? "bin";

  if (mime === "image/svg+xml") {
    return {
      kind: "image",
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

  if (mime === "image/gif") {
    const meta = await sharp(buf).metadata();
    return {
      kind: "image",
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
    kind: "image",
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

export function extForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? "bin";
}
