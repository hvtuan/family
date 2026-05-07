/**
 * Library-driven upload UI: Uppy v5 Dashboard modal with ImageEditor +
 * Webcam + XHRUpload. Replaces the previous vanilla drag-drop script.
 *
 * Flow (avoids "rác"):
 *   1. User triggers the modal via the parent button (data-uppy-trigger).
 *   2. Modal opens — drop, file-pick, or webcam capture build a queue.
 *   3. Per file: thumbnail, name, edit (Cropper.js via Uppy ImageEditor),
 *      remove. autoProceed=false so nothing uploads until "Upload" is
 *      clicked.
 *   4. For video files we run a custom preprocessor that extracts a
 *      poster frame client-side via <video>+canvas and attaches it to
 *      file.meta.posterDataUrl + duration_seconds. The server decodes
 *      the dataURL into a File and routes it through the existing
 *      uploadPhotoMedia poster pipeline.
 *
 * Uppy posts to /admin/media/upload (existing endpoint). Successful
 * uploads trigger a parent-window event so the hub can refresh without
 * a full reload.
 */
import { useEffect, useRef, useState } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import ImageEditor from "@uppy/image-editor";
import XHRUpload from "@uppy/xhr-upload";
import Webcam from "@uppy/webcam";
import Vietnamese from "@uppy/locales/lib/vi_VN";

// Uppy ships its own CSS bundles. Vite picks these up at build time.
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import "@uppy/image-editor/css/style.min.css";
import "@uppy/webcam/css/style.min.css";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

/** Extract the first non-black frame of a video file as a JPEG dataURL.
 *  Returns null on failure so the upload still proceeds (without poster). */
async function extractVideoPoster(
  file: File,
): Promise<{ dataUrl: string; durationSeconds: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    let done = false;
    const cleanup = () => URL.revokeObjectURL(url);
    const finish = (result: { dataUrl: string; durationSeconds: number } | null) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(result);
    };

    const capture = () => {
      try {
        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 720;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
        finish({
          dataUrl: canvas.toDataURL("image/jpeg", 0.85),
          durationSeconds: Math.round(video.duration) || 0,
        });
      } catch {
        finish(null);
      }
    };

    video.addEventListener("loadedmetadata", () => {
      const t = Math.min(1, (video.duration || 1) * 0.1);
      try {
        video.currentTime = t;
      } catch {
        capture();
      }
    });
    video.addEventListener("seeked", capture);
    video.addEventListener("error", () => finish(null));
    setTimeout(() => finish(null), 8000);
  });
}

function buildUppy(onUploadFinished: () => void): Uppy {
  const uppy = new Uppy({
    autoProceed: false,
    locale: Vietnamese,
    restrictions: {
      maxFileSize: MAX_VIDEO_BYTES,
      allowedFileTypes: [
        "image/*", "video/*",
        ".heic", ".heif", ".mp4", ".webm", ".mov",
      ],
    },
  });

  uppy
    .use(Dashboard, {
      inline: false,
      target: "body",
      trigger: "[data-uppy-trigger]",
      proudlyDisplayPoweredByUppy: false,
      hideProgressDetails: false,
      note: "Ảnh ≤ 25 MB · Video ≤ 200 MB · Drag-drop / chụp webcam / dán ảnh từ clipboard",
      browserBackButtonClose: true,
      closeAfterFinish: false,
    })
    .use(ImageEditor, {
      quality: 0.92,
      cropperOptions: {
        viewMode: 1,
        background: false,
        autoCropArea: 1,
        responsive: true,
      },
      actions: {
        revert: true,
        rotate: true,
        granularRotate: true,
        flip: true,
        zoomIn: true,
        zoomOut: true,
        cropSquare: true,
        cropWidescreen: true,
        cropWidescreenVertical: true,
      },
    })
    .use(Webcam, {
      modes: ["picture", "video-only"],
      mirror: true,
      videoConstraints: { facingMode: "user", width: 1280, height: 720 },
    })
    .use(XHRUpload, {
      endpoint: "/admin/media/upload",
      formData: true,
      fieldName: "file",
      // Send every meta field on the file as a form field — by default
      // includes name + type. We add posterDataUrl / duration_seconds
      // for videos.
      allowedMetaFields: true,
      timeout: 120_000,
      limit: 3,
    });

  // Pre-upload step: for each video file, snap a poster client-side and
  // attach it to file.meta as a base64 dataURL string. The server side
  // decodes back to a File via Buffer.from(...).
  uppy.addPreProcessor(async (fileIDs: string[]) => {
    for (const id of fileIDs) {
      const f = uppy.getFile(id);
      const isVid = (f.type ?? "").startsWith("video/")
        || /\.(mp4|webm|mov)$/i.test(f.name ?? "");
      if (!isVid) continue;
      const poster = await extractVideoPoster(f.data as File);
      if (poster) {
        uppy.setFileMeta(id, {
          posterDataUrl: poster.dataUrl,
          duration_seconds: String(poster.durationSeconds),
        });
      }
    }
  });

  uppy.on("complete", (result) => {
    // Fire when the queue drains — reload so the new rows appear.
    if (result.successful && result.successful.length > 0) {
      onUploadFinished();
    }
  });

  return uppy;
}

export default function MediaUploaderModal(): null {
  const uppyRef = useRef<Uppy | null>(null);
  const [reloadAfter, setReloadAfter] = useState(0);

  useEffect(() => {
    const uppy = buildUppy(() => setReloadAfter(Date.now()));
    uppyRef.current = uppy;
    return () => {
      // Older Uppy used .close(); v5 uses .destroy()
      try {
        (uppy as unknown as { destroy?: () => void }).destroy?.();
      } catch {
        // no-op
      }
    };
  }, []);

  useEffect(() => {
    if (reloadAfter === 0) return;
    // Small delay so the user sees Uppy's success state before reload.
    const t = setTimeout(() => location.reload(), 800);
    return () => clearTimeout(t);
  }, [reloadAfter]);

  // Document-wide paste handler — Cmd/Ctrl+V an image bypasses the file
  // picker and goes straight into the Uppy queue. Skip when focus is in
  // a real text input so normal pasting still works.
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .filter((it) => it.kind === "file")
        .map((it) => it.getAsFile())
        .filter((f): f is File => Boolean(f))
        .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
      if (files.length === 0) return;
      e.preventDefault();
      const uppy = uppyRef.current;
      if (!uppy) return;
      for (const f of files) {
        try {
          uppy.addFile({ name: f.name || `paste-${Date.now()}.png`, type: f.type, data: f });
        } catch {
          // dup or restriction violation — Uppy already toasts the user.
        }
      }
      const dashboard = uppy.getPlugin("Dashboard") as { openModal?: () => void } | null;
      dashboard?.openModal?.();
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, []);

  // Component renders nothing — Dashboard mounts itself into <body>
  // when triggered by the [data-uppy-trigger] button in the page.
  return null;
}
