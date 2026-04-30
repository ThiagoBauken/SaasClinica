import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Trash2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getCsrfHeaders } from "@/lib/csrf";
import type { AdminUserSession } from "./types";

interface Props {
  userId: number;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

export function SessionsList({ userId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["admin", "user-sessions", userId];

  const { data, isLoading } = useQuery<AdminUserSession[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/admin-panel/users/${userId}/sessions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao carregar sessões");
      return res.json();
    },
  });

  const revokeOne = useMutation({
    mutationFn: async (sid: string) => {
      const res = await fetch(
        `/api/admin-panel/users/${userId}/sessions/${encodeURIComponent(sid)}`,
        { method: "DELETE", headers: getCsrfHeaders(), credentials: "include" },
      );
      if (!res.ok) throw new Error("Falha ao revogar sessão");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sessão revogada" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const revokeAll = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin-panel/users/${userId}/sessions`, {
        method: "DELETE",
        headers: getCsrfHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao revogar sessões");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Sessões encerradas", description: `${data.revoked} revogada(s).` });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando sessões...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Sessões ativas</h3>
        {(data?.length ?? 0) > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => revokeAll.mutate()}
            disabled={revokeAll.isPending}
          >
            <LogOut className="h-4 w-4 mr-1" />
            Encerrar todas
          </Button>
        )}
      </div>

      {(data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma sessão ativa no momento.</p>
      ) : (
        <ul className="space-y-2">
          {data!.map((s) => (
            <li
              key={s.sid}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Monitor className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="text-sm flex-1 min-w-0">
                  <div className="font-mono text-xs truncate" title={s.sid}>
                    {s.sid.slice(0, 24)}…
                  </div>
                  <div className="text-muted-foreground">
                    Expira em: {fmtDate(s.expire)}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revokeOne.mutate(s.sid)}
                disabled={revokeOne.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
