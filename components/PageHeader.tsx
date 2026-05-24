type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, eyebrow, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-muted">{eyebrow}</p> : null}
        <h2 className="mt-1 text-2xl font-bold tracking-normal text-ink">{title}</h2>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
