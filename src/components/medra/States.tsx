import type { ReactNode } from "react";
import { Loader2, Inbox, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({ label = "Loading…", className }: { label?: string | undefined; className?: string | undefined }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground", className)}>
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong loading this data.",
  onRetry,
}: {
  message?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="size-5 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-bold text-primary hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string | undefined;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function QueryBoundary({
  isLoading,
  error,
  isEmpty,
  empty,
  children,
  loadingLabel,
  onRetry,
}: {
  isLoading: boolean;
  error?: unknown;
  isEmpty?: boolean | undefined;
  empty?: ReactNode;
  children: ReactNode;
  loadingLabel?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  if (isLoading) return <LoadingState label={loadingLabel} />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Something went wrong loading this data."}
        onRetry={onRetry}
      />
    );
  if (isEmpty && empty) return <>{empty}</>;
  return <>{children}</>;
}
