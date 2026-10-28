// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { Modal } from "./Modal";
import { Table, type SortState } from "./Table";
import { ToastProvider, useToast } from "./Toast";

afterEach(cleanup);

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );

describe("Modal", () => {
  function Harness({ onClose = () => {} }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>open</button>
        <Modal open={open} onClose={() => { setOpen(false); onClose(); }} title="Add contact">
          <input aria-label="Name" />
        </Modal>
      </>
    );
  }

  it("opens as a labelled dialog and focuses the first field", () => {
    wrap(<Harness />);
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByRole("dialog", { name: "Add contact" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  });

  it("closes on Escape and gives focus back to the trigger", () => {
    const onClose = vi.fn();
    wrap(<Harness onClose={onClose} />);
    const trigger = screen.getByText("open");
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes from the close button", () => {
    wrap(<Harness />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Table", () => {
  const rows = [
    { id: "a", name: "Ada" },
    { id: "b", name: "Ben" },
  ];

  function Harness({ onRowClick = () => {} }: { onRowClick?: (row: (typeof rows)[number]) => void }) {
    const [selected, setSelected] = useState(new Set<string>());
    const [sort, setSort] = useState<SortState>(null);
    return (
      <>
        <output data-testid="state">{`${[...selected].join(",")}|${sort ? `${sort.key}:${sort.direction}` : "none"}`}</output>
        <Table
          columns={[{ key: "name", header: "Name", sortable: true, cell: (r) => r.name }]}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={onRowClick}
          selected={selected}
          onSelectedChange={setSelected}
          sort={sort}
          onSortChange={setSort}
          selectAllLabel="Select all"
          selectRowLabel={(r) => `Select ${r.name}`}
        />
      </>
    );
  }
  const state = () => screen.getByTestId("state").textContent;

  it("selects rows and all rows", () => {
    wrap(<Harness />);
    fireEvent.click(screen.getByLabelText("Select Ada"));
    expect(state()).toBe("a|none");
    fireEvent.click(screen.getByLabelText("Select all"));
    expect(state()).toBe("a,b|none");
    fireEvent.click(screen.getByLabelText("Select all"));
    expect(state()).toBe("|none");
  });

  it("selecting a row does not open it", () => {
    const onRowClick = vi.fn();
    wrap(<Harness onRowClick={onRowClick} />);
    fireEvent.click(screen.getByLabelText("Select Ben"));
    expect(onRowClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Ben"));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it("cycles sort: ascending, descending, off", () => {
    wrap(<Harness />);
    const header = screen.getByRole("button", { name: /Name/ });
    fireEvent.click(header);
    expect(state()).toBe("|name:asc");
    fireEvent.click(header);
    expect(state()).toBe("|name:desc");
    fireEvent.click(header);
    expect(state()).toBe("|none");
  });
});

describe("Toast", () => {
  it("shows a message and hides it after a few seconds", () => {
    vi.useFakeTimers();
    function Trigger() {
      const toast = useToast();
      return <button onClick={() => toast("Contact saved")}>save</button>;
    }
    wrap(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("save"));
    expect(screen.getByText("Contact saved")).toBeTruthy();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText("Contact saved")).toBeNull();
    vi.useRealTimers();
  });
});
