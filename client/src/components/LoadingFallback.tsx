import { Loader2 } from "lucide-react";

interface LoadingFallbackProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingFallback({
  message = "Carregando...",
  fullScreen = false,
}: LoadingFallbackProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// Variante compacta para componentes inline
export function LoadingSpinner({ size = "default" }: { size?: "sm" | "default" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />;
}

// Skeleton loader para listas
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-16 bg-muted rounded-lg"></div>
        </div>
      ))}
    </div>
  );
}

// Skeleton loader para cards
export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-32 bg-muted rounded-lg mb-2"></div>
      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-muted rounded w-1/2"></div>
    </div>
  );
}
