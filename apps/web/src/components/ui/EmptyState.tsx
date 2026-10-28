export function EmptyState({
  title,
  description,
  action,
  icon = "◌",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-lg text-primary" aria-hidden>
        {icon}
      </span>
      <strong className="text-sm text-text-strong">{title}</strong>
      {description && <p className="max-w-sm text-xs text-text-subtle">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
