/**
 * CondolenceForm — public submission form for "Lời tưởng nhớ".
 *
 * Anonymous + name + relation + body. POSTs to /api/condolence which
 * marks the row pending (or auto-approved per setting). On success we
 * close the dialog and toast; the moderation flow takes over.
 */
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t, type Locale } from "@/i18n";

interface Props {
  memberId: string;
  lang?: Locale;
}

const RELATION_OPTIONS = [
  { value: "Con", label: "Con" },
  { value: "Cháu", label: "Cháu" },
  { value: "Bạn", label: "Bạn" },
  { value: "Đồng nghiệp", label: "Đồng nghiệp" },
  { value: "Khác", label: "Khác" },
];

export default function CondolenceForm({ memberId, lang = "vi" }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [relation, setRelation] = useState<string>("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const visitorName = String(data.get("visitorName") ?? "").trim();
    const body = String(data.get("body") ?? "").trim();
    if (!visitorName || body.length < 5) {
      toast.error("Vui lòng nhập họ tên và lời tưởng nhớ.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/condolence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          visitorName,
          visitorRelation: relation || null,
          body: { [lang]: body },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        toast.error(t("common.error", lang));
        setSubmitting(false);
        return;
      }
      setOpen(false);
      form.reset();
      setRelation("");
      toast.success(t("memorial.condolencePending", lang));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Toaster richColors position="bottom-center" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="u-btn u-btn-secondary px-6 py-2.5 rounded-md text-sm"
          >
            {t("memorial.condolenceCta", lang)}
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {t("memorial.condolenceCta", lang)}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 mt-2">
            <div className="grid gap-2">
              <Label htmlFor="cond-name">{t("memorial.condolenceFormName", lang)}</Label>
              <Input id="cond-name" name="visitorName" required maxLength={80} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cond-relation">
                {t("memorial.condolenceFormRelation", lang)}
              </Label>
              <Select value={relation} onValueChange={setRelation}>
                <SelectTrigger id="cond-relation">
                  <SelectValue placeholder="-- chọn --" />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cond-body">{t("memorial.condolenceFormBody", lang)}</Label>
              <Textarea id="cond-body" name="body" required rows={5} maxLength={1000} />
              <p className="text-xs text-muted-foreground">
                Lời tưởng nhớ sẽ hiện sau khi quản trị duyệt.
              </p>
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.loading", lang) : t("memorial.condolenceFormSubmit", lang)}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
