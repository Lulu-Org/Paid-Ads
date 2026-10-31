"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  approvalScopeSchema,
  type ApprovalPolicy,
  type ApprovalScope,
  type SpendLimit,
} from "@lulu/shared";
import { Button, Card, Modal, useToast } from "@/components/ui";
import { SectionHeading, StatusText } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff]";
const alertShares = [0.7, 0.8, 0.9] as const;
const approverRoles = ["reviewer", "owner", "editor"] as const;

// Design: "Billing & Controls". The monthly spend limit, the approval policy, payment status and the
// platforms' monthly charges.
export function BillingPage() {
  const t = useTranslations("billing");
  const tPlatform = useTranslations("platforms");
  const format = useFormat();
  const limit = useApi(() => api.billing.spendLimit(), []);
  const policy = useApi(() => api.billing.approvalPolicy(), []);
  const payment = useApi(() => api.billing.paymentMethod(), []);
  const statements = useApi(() => api.billing.statements(), []);
  const [editing, setEditing] = useState<"limit" | "policy" | null>(null);

  const l = limit.data;
  const share = l && l.monthly.amount > 0 ? Math.min(1, l.used.amount / l.monthly.amount) : 0;
  const month = (value: string) => format.monthYear(`${value}-01T12:00:00.000Z`);

  return (
    <>
      <PageHeader page="billing" />
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="flex min-w-0 flex-col">
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("limit.eyebrow")}</span>
          <strong className="mt-2 text-[22px] font-semibold text-text-strong">
            {l ? t.rich("limit.perMonth", { amount: format.money(l.monthly), unit: (chunks) => <small className="text-[10px] font-normal text-text-subtle">{chunks}</small> }) : "–"}
          </strong>
          <i
            className="mt-3 block h-1.5 rounded-full bg-surface-muted"
            role="progressbar"
            aria-label={t("limit.used")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
          >
            <em
              className={`block h-full rounded-full ${l && share >= l.alertAt ? "bg-warning" : "bg-[#6259d6]"}`}
              style={{ width: `${Math.round(share * 100)}%` }}
            />
          </i>
          <small className="mt-2 flex-1 text-[10px] text-text-muted">
            {l
              ? t("limit.usage", {
                  used: format.money(l.used),
                  remaining: format.money({ amount: Math.max(0, l.monthly.amount - l.used.amount), currency: l.monthly.currency }),
                })
              : "–"}
          </small>
          <Button variant="outline" className="mt-4 self-start" disabled={!l} onClick={() => setEditing("limit")}>
            {t("limit.edit")}
          </Button>
        </Card>

        <Card className="flex min-w-0 flex-col">
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("policy.eyebrow")}</span>
          <strong className="mt-2 text-[22px] font-semibold text-text-strong">
            {policy.data ? t.rich("policy.perChange", { amount: format.money(policy.data.threshold), unit: (chunks) => <small className="text-[10px] font-normal text-text-subtle">{chunks}</small> }) : "–"}
          </strong>
          <p className="mt-2 flex-1 text-[10px] text-text-muted">
            {policy.data
              ? t(`policy.summary.${policy.data.scope}`, { role: t(`roles.${policy.data.approverRole}`) })
              : "–"}
          </p>
          <Button variant="outline" className="mt-4 self-start" disabled={!policy.data} onClick={() => setEditing("policy")}>
            {t("policy.edit")}
          </Button>
        </Card>

        <Card className="flex min-w-0 flex-col">
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("payment.eyebrow")}</span>
          <strong className="mt-2 text-[22px] font-semibold text-text-strong">
            {payment.data ? t(`payment.status.${payment.data.status}`) : "–"}
          </strong>
          <p className="mt-2 flex-1 text-[10px] text-text-muted">
            {payment.data?.brand && payment.data.last4
              ? t("payment.card", { brand: payment.data.brand, last4: payment.data.last4 })
              : t("payment.noCard")}
            <br />
            {t(payment.data?.status === "active" ? "payment.canSpend" : "payment.cannotSpend")}
          </p>
          {/* Card details are entered at the payment provider (docs/api.md), never in this module. */}
          <small className="mt-4 text-[9px] text-text-subtle">{t("payment.managedByBilling")}</small>
        </Card>
      </section>

      <Card className="mt-5">
        <SectionHeading eyebrow={t("history.eyebrow")} title={t("history.title")} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-[11px]">
            <thead className="text-[8px] font-bold tracking-[0.08em] text-[#a0a1ad]">
              <tr>
                <th className="py-2 font-black">{t("history.statement")}</th>
                <th className="py-2 font-black">{t("history.provider")}</th>
                <th className="py-2 font-black">{t("history.amount")}</th>
                <th className="py-2 font-black">{t("history.status")}</th>
              </tr>
            </thead>
            <tbody>
              {statements.data?.data.map((row) => (
                <tr key={row.id} className="border-t border-surface-muted">
                  <td className="py-3 font-semibold text-text-strong">{month(row.month)}</td>
                  <td className="py-3 text-text-muted">{tPlatform(`${row.platform}.name`)}</td>
                  <td className="py-3 text-text-strong">{format.money(row.amount)}</td>
                  <td className="py-3">
                    <StatusText tone={row.status === "paid" ? "success" : "warning"}>{t(`history.statuses.${row.status}`)}</StatusText>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {l && (
        <LimitModal
          open={editing === "limit"}
          value={l}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            limit.reload();
          }}
        />
      )}
      {policy.data && (
        <PolicyModal
          open={editing === "policy"}
          value={policy.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            policy.reload();
          }}
        />
      )}
    </>
  );
}

/** Whole euros, accepting "16000", "16,000" or "16.000". */
function parseAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  return digits === "" ? null : Number(digits);
}

function LimitModal({ open, value, onClose, onSaved }: { open: boolean; value: SpendLimit; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("billing.limitForm");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const format = useFormat();
  const [amount, setAmount] = useState("");
  const [alertAt, setAlertAt] = useState(0.8);
  const [notify, setNotify] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(String(value.monthly.amount));
    setAlertAt(value.alertAt);
    setNotify(value.notifyBeforeLimit);
    setInvalid(false);
  }, [open, value]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const monthly = parseAmount(amount);
    if (monthly === null || monthly <= 0) {
      setInvalid(true);
      return;
    }
    setSaving(true);
    try {
      await api.billing.updateSpendLimit({
        monthly: { amount: monthly, currency: value.monthly.currency },
        alertAt,
        notifyBeforeLimit: notify,
      });
      toast(t("saved"));
      onSaved();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={t("title")}>
      <p className="mb-4 text-[11px] text-text-muted">{t("description")}</p>
      <form onSubmit={save} noValidate className="grid gap-3.5">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold text-neutral">{t("monthly", { currency: value.monthly.currency })}</span>
          <input
            className={inputClass}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={invalid || undefined}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold text-neutral">{t("alertAt")}</span>
          <select className={inputClass} value={alertAt} onChange={(e) => setAlertAt(Number(e.target.value))}>
            {alertShares.map((share) => (
              <option key={share} value={share}>
                {t("alertOption", { share: format.percent(share) })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" className="accent-[#6259d6]" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          {t("notify")}
        </label>
        {invalid && (
          <p role="alert" className="text-[10px] text-[#c2413d]">
            {t("invalid")}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-2 border-t border-[#efedf4] pt-4">
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {tCommon("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PolicyModal({ open, value, onClose, onSaved }: { open: boolean; value: ApprovalPolicy; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("billing.policyForm");
  const tBilling = useTranslations("billing");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [scope, setScope] = useState<ApprovalScope>("budget_and_launch");
  const [role, setRole] = useState<ApprovalPolicy["approverRole"]>("reviewer");
  const [amount, setAmount] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope(value.scope);
    setRole(value.approverRole);
    setAmount(String(value.threshold.amount));
    setInvalid(false);
  }, [open, value]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const threshold = parseAmount(amount);
    if (threshold === null) {
      setInvalid(true);
      return;
    }
    setSaving(true);
    try {
      await api.billing.updateApprovalPolicy({
        scope,
        approverRole: role,
        threshold: { amount: threshold, currency: value.threshold.currency },
      });
      toast(t("saved"));
      onSaved();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={t("title")}>
      <p className="mb-4 text-[11px] text-text-muted">{t("description")}</p>
      <form onSubmit={save} noValidate className="grid gap-3.5">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold text-neutral">{t("scope")}</span>
          <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value as ApprovalScope)}>
            {approvalScopeSchema.options.map((s) => (
              <option key={s} value={s}>
                {t(`scopes.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold text-neutral">{t("role")}</span>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as ApprovalPolicy["approverRole"])}>
            {approverRoles.map((r) => (
              <option key={r} value={r}>
                {tBilling(`roles.${r}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold text-neutral">{t("threshold", { currency: value.threshold.currency })}</span>
          <input
            className={inputClass}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={invalid || undefined}
          />
        </label>
        {invalid && (
          <p role="alert" className="text-[10px] text-[#c2413d]">
            {t("invalid")}
          </p>
        )}
        <p className="text-[10px] text-text-subtle">{t("draftHint")}</p>
        <div className="mt-1 flex justify-end gap-2 border-t border-[#efedf4] pt-4">
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {tCommon("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
