import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "Ocorreu um erro",
  message = "Não foi possível carregar as informações. Tente novamente.",
  error,
  onRetry,
  retryLabel = "Tentar novamente",
  className,
}: ErrorStateProps) {
  const errorDetails =
    error instanceof Error ? error.message : typeof error === "string" ? error : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4",
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-2">{message}</p>
      {errorDetails && (
        <p className="text-xs text-muted-foreground/70 max-w-md mb-4 font-mono">
          {errorDetails}
        </p>
      )}
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2 mt-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
