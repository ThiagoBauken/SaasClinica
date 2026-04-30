import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/core/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { getCsrfHeaders } from "@/lib/csrf";

/**
 * Banner persistente exibido enquanto o admin está impersonando outro usuário.
 * Renderizado no DashboardLayout. Lê `user.impersonator` (preenchido pelo
 * middleware impersonationContext do backend).
 */
export function ImpersonationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const stop = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin-panel/users/stop-impersonate", {
        method: "POST",
        headers: getCsrfHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao encerrar impersonação");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Voltou ao admin original" });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      window.location.href = "/superadmin";
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  if (!user || !(user as any).impersonator) return null;
  const imp = (user as any).impersonator as { id: number; username: string; fullName: string };

  return (
    <div className="sticky top-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between gap-3 shadow">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Você está vendo como <strong>{user.fullName}</strong> · admin original:{" "}
          <strong>{imp.fullName}</strong>
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => stop.mutate()}
        disabled={stop.isPending}
      >
        {stop.isPending ? (
          <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Encerrando...</>
        ) : (
          <><LogOut className="h-4 w-4 mr-1" />Sair do impersonate</>
        )}
      </Button>
    </div>
  );
}
