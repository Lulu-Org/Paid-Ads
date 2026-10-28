"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Overlay } from "./Overlay";

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  wide = false,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  wide?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const titleId = useId();

  return (
    <Overlay
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      containerClassName="items-center justify-center p-2 sm:p-4"
      panelClassName={`max-h-[calc(100vh-16px)] w-full overflow-auto rounded-[15px] border border-[#e5e3ed] bg-surface p-5 shadow-[0_24px_70px_#201c4b2c] ${wide ? "sm:max-w-[800px]" : "sm:max-w-[630px]"}`}
    >
      <PanelHeader titleId={titleId} title={title} eyebrow={eyebrow} onClose={onClose} closeLabel={t("close")} />
      <div className="mt-5">{children}</div>
      {footer && <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">{footer}</div>}
    </Overlay>
  );
}

export function PanelHeader({
  titleId,
  title,
  eyebrow,
  onClose,
  closeLabel,
}: {
  titleId: string;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-5">
      <div>
        {eyebrow && (
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{eyebrow}</span>
        )}
        <h2 id={titleId} className="mt-1.5 text-xl font-semibold tracking-tight text-text">
          {title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="grid size-8 place-items-center rounded-md text-text-subtle hover:bg-surface-muted"
      >
        ✕
      </button>
    </div>
  );
}
