"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { PanelHeader } from "./Modal";
import { Overlay } from "./Overlay";

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  // The Paid Ads campaign drawer is wider (660px in the design).
  wide?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const titleId = useId();

  return (
    <Overlay
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      containerClassName="justify-end"
      panelClassName={`m-2 h-[calc(100vh-16px)] w-full overflow-auto rounded-[14px] bg-surface p-6 shadow-[-20px_0_60px_#201c4b1d] sm:m-0 sm:h-full sm:rounded-none ${wide ? "sm:max-w-[660px]" : "sm:max-w-[430px]"}`}
    >
      <PanelHeader titleId={titleId} title={title} eyebrow={eyebrow} onClose={onClose} closeLabel={t("close")} />
      <div className="mt-6">{children}</div>
    </Overlay>
  );
}
