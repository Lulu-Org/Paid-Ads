"use client";

import { useEffect, useRef, useState } from "react";

export type CardMenuEntry =
  | { kind: "item"; key: string; label: string; onSelect: () => void; danger?: boolean }
  | { kind: "heading"; key: string; label: string }
  | { kind: "separator"; key: string };

/**
 * The "•••" menu on a board card (deals, leads). Also the keyboard and touch way to move a card,
 * so boards never depend on dragging alone. Pointer presses stop here, so opening it never starts a drag.
 */
export function CardMenu({ label, entries }: { label: string; entries: CardMenuEntry[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "block w-full rounded-md px-2.5 py-1.5 text-left text-[10px] hover:bg-surface-muted";

  return (
    <div ref={root} className="relative z-10" onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="grid min-h-8 min-w-8 place-items-center rounded px-1 text-[#9e9aaa] hover:bg-surface-muted"
      >
        •••
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-6 right-0 w-48 rounded-lg border border-border bg-surface p-1 shadow-[0_12px_30px_#201c4b1f]"
        >
          {entries.map((entry) =>
            entry.kind === "separator" ? (
              <div key={entry.key} className="my-1 border-t border-border" role="separator" />
            ) : entry.kind === "heading" ? (
              <span
                key={entry.key}
                className="block px-2.5 pt-1 pb-0.5 text-[8px] font-black tracking-[0.12em] text-rail-label uppercase"
              >
                {entry.label}
              </span>
            ) : (
              <button
                key={entry.key}
                type="button"
                role="menuitem"
                className={`${item} ${entry.danger ? "text-[#c2413d]" : "text-text-strong"}`}
                onClick={() => {
                  setOpen(false);
                  entry.onSelect();
                }}
              >
                {entry.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
