/**
 * IncenseButton — public "Thắp một nén tâm hương" interaction.
 *
 * Tone target (per feedback memory `family_memorial_tone`):
 *   - warm × modern, NOT gothic
 *   - subtle ember glow on success (~1.5s, NOT 8s smoke cinematic)
 *   - soft canvas-confetti gold particles (NOT pop tưng bừng)
 *   - prefers-reduced-motion respected via Framer Motion
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { toast, Toaster } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t, type Locale } from "@/i18n";

interface Props {
  memberId: string;
  initialCount: number;
  anniversaryYear: number;
  lang?: Locale;
  memorialEnabled: boolean;
}

export default function IncenseButton({
  memberId,
  initialCount,
  anniversaryYear,
  lang = "vi",
  memorialEnabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [submitting, setSubmitting] = useState(false);
  const [glowKey, setGlowKey] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const visitorName = String(data.get("visitorName") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    if (!visitorName) {
      toast.error("Vui lòng nhập họ tên.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/incense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          visitorName,
          message: message ? { [lang]: message } : undefined,
          anniversaryYear,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        if (body.reason === "rate_limit") {
          toast.error(t("memorial.incenseRateLimit", lang));
        } else if (body.reason === "memorial_disabled") {
          toast.error(t("memorial.incenseDisabled", lang));
        } else {
          toast.error(t("common.error", lang));
        }
        setSubmitting(false);
        return;
      }
      setCount((c) => c + 1);
      setOpen(false);
      setGlowKey((k) => k + 1);
      toast.success(t("memorial.incenseSuccess", lang));
      if (!reduceMotion) fireConfetti(buttonRef.current);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative inline-flex flex-col items-center gap-2">
      <Toaster richColors position="bottom-center" />

      <AnimatePresence>
        {glowKey > 0 && (
          <motion.span
            key={glowKey}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0, 0.55, 0], scale: [0.9, 1.25, 1.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 -z-10 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(214,160,80,0.55) 0%, rgba(214,160,80,0.18) 45%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
        )}
      </AnimatePresence>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            ref={buttonRef}
            type="button"
            disabled={!memorialEnabled}
            className="u-btn u-btn-primary px-7 py-3 rounded-md font-display text-base shadow-[0_8px_24px_-12px_rgba(155,46,40,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🌸 {t("memorial.incenseButton", lang)}
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {t("memorial.incenseDialogTitle", lang)}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 mt-2">
            <div className="grid gap-2">
              <Label htmlFor="incense-name">{t("memorial.incenseFieldName", lang)}</Label>
              <Input
                id="incense-name"
                name="visitorName"
                required
                maxLength={80}
                autoComplete="name"
                placeholder="Họ và tên"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="incense-message">{t("memorial.incenseFieldMessage", lang)}</Label>
              <Textarea
                id="incense-message"
                name="message"
                rows={3}
                maxLength={200}
                placeholder="Lời nhắn ngắn (tuỳ chọn)"
              />
              <p className="text-xs text-muted-foreground">
                {t("memorial.incenseFieldMessageHint", lang)}
              </p>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.loading", lang) : t("memorial.incenseSubmit", lang)}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <p className="text-sm text-ink-3 m-0" aria-live="polite">
        {count > 0
          ? t("memorial.incenseCount", lang, { count })
          : t("memorial.incenseEmpty", lang)}
      </p>
    </div>
  );
}

function fireConfetti(origin: HTMLElement | null): void {
  if (!origin) return;
  const rect = origin.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  void confetti({
    particleCount: 28,
    spread: 55,
    startVelocity: 22,
    gravity: 0.7,
    ticks: 130,
    origin: { x, y },
    colors: ["#D6A050", "#E8C170", "#FFE9B0", "#C99A55"],
    scalar: 0.85,
  });
}
