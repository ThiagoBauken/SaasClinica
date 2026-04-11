import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  variant?: "table" | "cards" | "list" | "form" | "spinner";
  rows?: number;
  className?: string;
  label?: string;
}

export function LoadingState({
  variant = "spinner",
  rows = 5,
  className,
  label = "Carregando...",
}: LoadingStateProps) {
  if (variant === "spinner") {
    return (
      <div
        className={cn("flex items-center justify-center py-12", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-3 text-sm text-muted-foreground">{label}</span>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div
        className={cn("space-y-3", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
      >
        <div className="flex gap-4 pb-2 border-b">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-10 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div
        className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-3 p-4 border rounded-lg">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div
        className={cn("space-y-3", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div
        className={cn("space-y-4", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
