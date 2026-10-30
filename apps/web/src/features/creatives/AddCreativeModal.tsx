"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { creativeTypeSchema, type CreativeType } from "@lulu/shared";
import { Button, Modal, useToast } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";

// Files the platforms take for ads. 50 MB covers short videos; bigger files belong in the platform.
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime,application/pdf";
const MAX_BYTES = 50 * 1024 * 1024;

const input =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";

// A type from the file, so most uploads need no choice.
function typeFor(file: File): CreativeType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "document";
  return null;
}

export function AddCreativeModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("creatives.addForm");
  const tType = useTranslations("campaigns.creativeTypes");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const fileId = useId();
  const [name, setName] = useState("");
  const [type, setType] = useState<CreativeType>("image");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setType("image");
    setFile(null);
    setFileError(null);
    setSubmitted(false);
  }, [open]);

  const pick = (picked: File | null) => {
    setFileError(null);
    if (!picked) return setFile(null);
    if (picked.size > MAX_BYTES) {
      setFile(null);
      return setFileError(t("errors.tooBig", { size: format.number(MAX_BYTES / 1024 / 1024) }));
    }
    if (!typeFor(picked)) {
      setFile(null);
      return setFileError(t("errors.fileType"));
    }
    setFile(picked);
    setType(typeFor(picked)!);
    if (!name.trim()) setName(picked.name.replace(/\.[^.]+$/, ""));
  };

  const save = async () => {
    setSubmitted(true);
    if (!name.trim() || fileError) return;
    setSaving(true);
    try {
      await api.creatives.create({ name: name.trim(), type, file });
      toast(t("saved", { name: name.trim() }));
      onSaved();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={t("title")}>
      <p className="-mt-2 mb-4 text-[11px] leading-relaxed text-text-muted">{t("description")}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="grid gap-3.5"
      >
        <label
          htmlFor={fileId}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0] ?? null);
          }}
          className="grid cursor-pointer place-items-center gap-1.5 rounded-xl border border-dashed border-[#cfcbe4] bg-[#fbfaff] px-4 py-6 text-center hover:bg-[#f5f3ff]"
        >
          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary">⇧</span>
          <strong className="text-[11px] text-text-strong">{file ? file.name : t("drop")}</strong>
          <small className="text-[10px] text-text-subtle">{file ? format.compactBytes(file.size) : t("formats", { size: format.number(MAX_BYTES / 1024 / 1024) })}</small>
          <input id={fileId} type="file" accept={ACCEPT} className="sr-only" aria-label={t("file")} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
        {fileError && <span className="text-[10px] text-[#c2413d]">{fileError}</span>}

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <label htmlFor="creative-name" className="text-[10px] font-extrabold text-neutral">{t("name")}</label>
            <input id="creative-name" className={input} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && !name.trim() ? true : undefined} />
            {submitted && !name.trim() && <span className="text-[10px] text-[#c2413d]">{t("errors.nameRequired")}</span>}
          </div>
          <div className="grid content-start gap-1.5">
            <label htmlFor="creative-type" className="text-[10px] font-extrabold text-neutral">{t("type")}</label>
            <select id="creative-type" className={input} value={type} onChange={(e) => setType(e.target.value as CreativeType)}>
              {creativeTypeSchema.options.map((option) => (
                <option key={option} value={option}>{tType(option)}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[10px] text-text-subtle">{t("approvalNote")}</p>
        <div className="flex justify-end gap-2 border-t border-[#efedf4] pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{tCommon("cancel")}</Button>
          <Button type="submit" loading={saving}>{t("submit")}</Button>
        </div>
      </form>
    </Modal>
  );
}
