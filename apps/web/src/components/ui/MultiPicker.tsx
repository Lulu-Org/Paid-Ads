"use client";

import { useEffect, useRef, useState } from "react";

const boxClass =
  "flex w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-left text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff]";

export interface PickerItem {
  id: string;
  name: string;
  // Searched along with the name (e.g. an email or domain).
  searchText?: string | null;
  // Shown faintly beside an item that is not picked (e.g. the contact's other company).
  hint?: string | undefined;
}

/**
 * A dropdown with a search box to pick several existing records (Dave, Oct 24 and 26, 2026): the
 * contacts of a company, and the companies of a contact. `labels` are already translated.
 */
export function MultiPicker({
  id,
  items,
  value,
  onChange,
  labels,
}: {
  id: string;
  items: PickerItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  labels: { list: string; none: string; count: (count: number) => string; search: string; empty: string };
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const box = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && (event.stopPropagation(), setOpen(false));
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const selected = items.filter((item) => value.includes(item.id));
  const needle = search.trim().toLocaleLowerCase();
  const shown = needle
    ? items.filter((item) => `${item.name} ${item.searchText ?? ""}`.toLocaleLowerCase().includes(needle))
    : items;
  // Closes after each pick (Sudais, Oct 26, 2026); open it again to pick another.
  const toggle = (itemId: string) => {
    onChange(value.includes(itemId) ? value.filter((v) => v !== itemId) : [...value, itemId]);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={box} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={boxClass}
      >
        <span className={`truncate ${selected.length ? "" : "text-text-faint"}`}>
          {selected.length === 0
            ? labels.none
            : selected.length <= 2
              ? selected.map((c) => c.name).join(", ")
              : labels.count(selected.length)}
        </span>
        <span aria-hidden className="text-text-subtle">
          {open ? "⌃" : "⌄"}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 left-0 z-10 mt-1 rounded-md border border-border bg-surface p-2 shadow-card">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            className="mb-1.5 w-full rounded-md border border-border-strong px-2.5 py-1.5 text-[11px] outline-none focus:border-[#8e83de]"
          />
          <ul role="listbox" aria-label={labels.list} aria-multiselectable className="max-h-48 overflow-y-auto">
            {items.length === 0 && <li className="px-2 py-2 text-[10px] text-text-subtle">{labels.empty}</li>}
            {shown.map((item) => {
              const elsewhere = item.hint;
              return (
                <li key={item.id} role="option" aria-selected={value.includes(item.id)}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={value.includes(item.id)}
                      onChange={() => toggle(item.id)}
                      className="accent-[#6259d6]"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {elsewhere && !value.includes(item.id) && (
                      <small className="truncate text-[9px] text-text-faint">{elsewhere}</small>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
