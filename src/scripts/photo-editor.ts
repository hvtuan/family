/**
 * Pre-upload image editor backed by Cropper.js v1
 * (https://github.com/fengyuanchen/cropperjs, MIT).
 *
 * Attaches to any <input type="file" data-photo-edit>. After the user
 * picks a file, instantiates a Cropper on a hidden <img> and exposes
 * crop / rotate / flip / aspect / max-dimension / reset / apply
 * controls on the surrounding panel. "Apply" renders the current
 * cropper viewport to a canvas, encodes a Blob, and replaces the
 * input's File via DataTransfer so the existing form submit just
 * uploads the edited bytes.
 *
 * The HTML for the panel lives in PhotoEditorInput.astro; this module
 * only wires up behavior.
 */

import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

type Wiring = {
  input: HTMLInputElement;
  panel: HTMLElement;
  img: HTMLImageElement;
  status: HTMLElement;
};

let counter = 0;

function findWiring(input: HTMLInputElement): Wiring | null {
  const panel = input.parentElement?.querySelector<HTMLElement>("[data-photo-editor-panel]");
  if (!panel) return null;
  const img = panel.querySelector<HTMLImageElement>("[data-photo-target]");
  const status = panel.querySelector<HTMLElement>("[data-photo-status]");
  if (!img || !status) return null;
  return { input, panel, img, status };
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function attach(input: HTMLInputElement) {
  const w = findWiring(input);
  if (!w) return;
  counter++;

  let cropper: Cropper | null = null;
  let origFile: File | null = null;
  let origUrl: string | null = null;

  const setStatus = (text: string) => {
    w.status.textContent = text;
  };

  const destroy = () => {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    if (origUrl) {
      URL.revokeObjectURL(origUrl);
      origUrl = null;
    }
  };

  const initCropper = (file: File) => {
    destroy();
    origFile = file;
    origUrl = URL.createObjectURL(file);
    w.img.src = origUrl;
    w.panel.removeAttribute("hidden");

    cropper = new Cropper(w.img, {
      viewMode: 1,
      autoCropArea: 1,
      dragMode: "move",
      background: false,
      responsive: true,
      ready() {
        const data = cropper!.getImageData();
        setStatus(
          `${Math.round(data.naturalWidth)}×${Math.round(data.naturalHeight)} · ${fmtBytes(file.size)} (gốc)`,
        );
      },
    });
  };

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      destroy();
      w.panel.setAttribute("hidden", "");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus("Chỉ chấp nhận file ảnh.");
      w.panel.removeAttribute("hidden");
      return;
    }
    initCropper(file);
  });

  // Rotate + flip + aspect ratio + reset
  w.panel.querySelectorAll<HTMLElement>("[data-photo-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (!cropper) return;
      const action = el.dataset.photoAction!;
      switch (action) {
        case "rotate-left":
          cropper.rotate(-90);
          break;
        case "rotate-right":
          cropper.rotate(90);
          break;
        case "flip-h":
          cropper.scaleX(-(cropper.getData().scaleX || 1));
          break;
        case "flip-v":
          cropper.scaleY(-(cropper.getData().scaleY || 1));
          break;
        case "reset":
          cropper.reset();
          break;
      }
    });
  });

  w.panel.querySelectorAll<HTMLButtonElement>("[data-photo-aspect]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!cropper) return;
      const v = btn.dataset.photoAspect!;
      const ratio = v === "free" ? NaN : Number(v);
      cropper.setAspectRatio(ratio);
      // Mark active button
      w.panel.querySelectorAll<HTMLButtonElement>("[data-photo-aspect]").forEach((b) =>
        b.classList.toggle("ring-2", b === btn),
      );
      w.panel.querySelectorAll<HTMLButtonElement>("[data-photo-aspect]").forEach((b) =>
        b.classList.toggle("ring-brand-500", b === btn),
      );
    });
  });

  // Apply: render canvas → blob → replace input.files
  const applyBtn = w.panel.querySelector<HTMLButtonElement>("[data-photo-apply]");
  if (applyBtn) {
    applyBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!cropper || !origFile) return;
      setStatus("đang xử lý…");

      const maxSel = w.panel.querySelector<HTMLSelectElement>("[data-photo-max]");
      const maxDim = maxSel && maxSel.value ? Number(maxSel.value) : null;

      const canvasOpts: Cropper.GetCroppedCanvasOptions = {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      };
      if (maxDim) {
        canvasOpts.maxWidth = maxDim;
        canvasOpts.maxHeight = maxDim;
      }
      const canvas = cropper.getCroppedCanvas(canvasOpts);

      const outType =
        origFile.type === "image/jpeg" || origFile.type === "image/jpg"
          ? "image/jpeg"
          : origFile.type === "image/webp"
            ? "image/webp"
            : "image/png";
      const quality =
        outType === "image/jpeg" || outType === "image/webp" ? 0.9 : undefined;

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, outType, quality),
      );
      if (!blob) {
        setStatus("Lỗi: không tạo được blob.");
        return;
      }

      const ext = outType.split("/")[1] === "jpeg" ? "jpg" : outType.split("/")[1];
      const baseName = origFile.name.replace(/\.[^.]+$/, "");
      const newFile = new File([blob], `${baseName}.${ext}`, { type: outType });

      const dt = new DataTransfer();
      dt.items.add(newFile);
      input.files = dt.files;

      setStatus(
        `${canvas.width}×${canvas.height} · ${fmtBytes(origFile.size)} → ${fmtBytes(newFile.size)} (đã áp dụng)`,
      );

      applyBtn.classList.add("bg-success-50", "text-success-700", "border-success-100");
      applyBtn.textContent = "✓ Đã áp dụng";
      setTimeout(() => {
        applyBtn.classList.remove("bg-success-50", "text-success-700", "border-success-100");
        applyBtn.textContent = "Áp dụng chỉnh sửa";
      }, 2500);
    });
  }

  // Defensive: if the form is dropped (page unload) clean up.
  window.addEventListener("beforeunload", destroy);
}

function init() {
  document
    .querySelectorAll<HTMLInputElement>("input[type=file][data-photo-edit]")
    .forEach(attach);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
