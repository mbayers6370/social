import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="max-w-reading space-y-5 py-16 sm:py-24">
      <h1 className="text-display">{title}</h1>
      <div className="max-w-prose text-lg leading-8 text-muted-foreground">
        {children}
      </div>
      {action && <div className="pt-3">{action}</div>}
    </section>
  );
}
