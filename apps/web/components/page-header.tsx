export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-prose text-[15px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
