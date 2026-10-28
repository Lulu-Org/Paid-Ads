"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Open overlays, newest last. Only the top one reacts to Escape and Tab,
// so a confirm dialog opened from a drawer closes on its own.
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared behaviour for Modal and Drawer: portal, backdrop, Escape to close,
// focus kept inside while open and given back to the trigger after closing.
export function Overlay({
  open,
  onClose,
  labelledBy,
  panelClassName,
  containerClassName,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  panelClassName: string;
  containerClassName: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = Symbol();
    stack.push(id);
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Start in the first form field when there is one (like the design's add contact form).
    const firstField = panel.current?.querySelector<HTMLElement>("input:not([type=checkbox]):not([disabled]), select, textarea");
    (firstField ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panel.current)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(id), 1);
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex ${containerClassName}`}>
      <div className="absolute inset-0 bg-[#201c4b]/30" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative outline-none ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
