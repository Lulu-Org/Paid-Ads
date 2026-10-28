"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adsRoles,
  channelScopeSchema,
  roleMatrix,
  teamInviteSchema,
  type AdsRole,
  type Capability,
  type ChannelScope,
  type TeamMember,
} from "@lulu/shared";
import { Avatar, Button, Card, Modal, Pill, SkeletonRows, useToast } from "@/components/ui";
import { SectionHeading } from "@/components/ads";
import { PageHeader } from "@/components/layout/PageHeader";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { avatarTone, initials } from "@/lib/initials";
import { useApi } from "@/lib/useApi";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff]";
const invitableRoles = adsRoles.filter((r): r is Exclude<AdsRole, "owner"> => r !== "owner");
const capabilities = ["view", "edit", "budget", "launch"] as const;

// What each role may do, as ticks and crosses on a member card (design: "Team & Permissions").
const highlights: Record<AdsRole, [string, boolean][]> = {
  owner: [["allChannels", true], ["budgetApproval", true], ["launch", true]],
  editor: [["campaignsCreatives", true], ["reports", true], ["billing", false]],
  reviewer: [["reports", true], ["budgetApproval", true], ["launch", false]],
  analyst: [["reports", true], ["budgetApproval", false], ["launch", false]],
};

// Design: "Team & Permissions". Who can see results, change budgets, approve creatives and launch.
export function TeamPage() {
  const t = useTranslations("team");
  const team = useApi(() => api.team.list(), []);
  const [inviting, setInviting] = useState(false);

  const mark = (value: Capability) => (value === "yes" ? "✓" : value === "request" ? t("matrix.request") : "—");

  return (
    <>
      <PageHeader
        page="team"
        actions={
          <Button icon="＋" onClick={() => setInviting(true)}>
            {t("invite")}
          </Button>
        }
      />
      {team.loading && !team.data ? (
        <SkeletonRows rows={3} />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={t("membersLabel")}>
          {team.data?.data.map((member) => (
            <MemberCard key={member.userId} member={member} onChanged={team.reload} />
          ))}
        </section>
      )}

      <Card className="mt-5">
        <SectionHeading eyebrow={t("matrix.eyebrow")} title={t("matrix.title")} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[11px]">
            <thead className="text-[9px] tracking-[0.12em] text-text-subtle uppercase">
              <tr>
                <th className="py-2 font-black">{t("matrix.role")}</th>
                {capabilities.map((c) => (
                  <th key={c} className="py-2 font-black">
                    {t(`matrix.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adsRoles.map((role) => (
                <tr key={role} className="border-t border-surface-muted">
                  <td className="py-3 font-semibold text-text-strong">{t(`roles.${role}`)}</td>
                  {capabilities.map((c) => (
                    <td key={c} className="py-3 text-text-muted">
                      {mark(roleMatrix[role][c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <InviteModal
        open={inviting}
        onClose={() => setInviting(false)}
        onSaved={() => {
          setInviting(false);
          team.reload();
        }}
      />
    </>
  );
}

function MemberCard({ member, onChanged }: { member: TeamMember; onChanged: () => void }) {
  const t = useTranslations("team");
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const changeRole = async (adsRole: Exclude<AdsRole, "owner">) => {
    try {
      await api.team.update(member.userId, { adsRole });
      toast(t("roleChanged", { name: member.name, role: t(`roles.${adsRole}`) }));
      onChanged();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <article className="rounded-[13px] border border-[#e8e7f0] bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <Avatar initials={initials(member.name)} tone={avatarTone(member.name)} />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-[12px] text-text-strong">{member.name}</strong>
          {/* Invited people have no name yet, so the email is already the name. */}
          {(member.title ?? (member.name !== member.email ? member.email : null)) && (
            <small className="block truncate text-[10px] text-text-subtle">{member.title ?? member.email}</small>
          )}
        </div>
        {member.invited ? <Pill tone="info">{t("invited")}</Pill> : <Pill tone="violet">{t(`roles.${member.adsRole}`)}</Pill>}
      </div>
      <ul className="mt-4 grid gap-1 text-[11px]">
        {highlights[member.adsRole].map(([key, allowed]) => (
          <li key={key} className={allowed ? "text-text-muted" : "text-text-subtle"}>
            <span aria-hidden className={allowed ? "text-success" : "text-[#c2413d]"}>
              {allowed ? "✓" : "×"}
            </span>{" "}
            <span className="sr-only">{t(allowed ? "allowed" : "notAllowed")}</span>
            {t(`highlights.${key}`)}
          </li>
        ))}
      </ul>
      {member.adsRole !== "owner" && (
        <label className="mt-4 flex items-center justify-between gap-2 border-t border-surface-muted pt-3 text-[10px] text-text-subtle">
          {t("changeRole")}
          <select
            value={member.adsRole}
            onChange={(e) => changeRole(e.target.value as Exclude<AdsRole, "owner">)}
            className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[11px] text-text"
          >
            {invitableRoles.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </select>
        </label>
      )}
    </article>
  );
}

function InviteModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("team.inviteForm");
  const tTeam = useTranslations("team");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<AdsRole, "owner">>("editor");
  const [scope, setScope] = useState<ChannelScope>("all");
  const [creatives, setCreatives] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setRole("editor");
    setScope("all");
    setCreatives(true);
    setInvalid(false);
  }, [open]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = teamInviteSchema.safeParse({ email: email.trim(), adsRole: role, channelScope: scope, canApproveCreatives: creatives });
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setSaving(true);
    try {
      await api.team.invite(parsed.data);
      toast(t("sent", { email: parsed.data.email }));
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
          <span className="text-[10px] font-extrabold text-neutral">{t("email")}</span>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            aria-invalid={invalid || undefined}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold text-neutral">{t("role")}</span>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Exclude<AdsRole, "owner">)}>
            {invitableRoles.map((r) => (
              <option key={r} value={r}>
                {tTeam(`roles.${r}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-extrabold text-neutral">{t("scope")}</span>
          <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value as ChannelScope)}>
            {channelScopeSchema.options.map((s) => (
              <option key={s} value={s}>
                {t(`scopes.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" className="accent-[#6259d6]" checked={creatives} onChange={(e) => setCreatives(e.target.checked)} />
          {t("creatives")}
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
            {t("submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
