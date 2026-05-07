import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center",
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-8">
          {icon}
        </div>
      )}
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5 flex items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
