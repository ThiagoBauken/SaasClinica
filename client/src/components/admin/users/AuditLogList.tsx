import { useQuery } from "@tanstack/react-query";
import { Loader2, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AuditLogEntry } from "./types";

interface Props {
  userId: number;
}

const ACTION_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  login_success: { label: "Login OK", tone: "outline" },
  login_failed: { label: "Login falhou", tone: "secondary" },
  login_locked: { label: "Conta bloqueada", tone: "destructive" },
  account_unlocked: { label: "Desbloqueio", tone: "outline" },
  password_reset_requested: { label: "Reset solicitado", tone: "outline" },
  password_reset_completed: { label: "Senha redefinida", tone: "outline" },
  mfa_enabled: { label: "MFA ativado", tone: "default" },
  mfa_disabled: { label: "MFA desativado", tone: "secondary" },
  mfa_reset_by_admin: { label: "MFA resetado", tone: "destructive" },
  email_verified: { label: "E-mail verificado", tone: "default" },
  email_marked_verified_by_admin: { label: "Verificado pelo admin", tone: "default" },
  account_deactivated_by_admin: { label: "Desativado", tone: "destructive" },
  account_activated_by_admin: { label: "Reativado", tone: "outline" },
  account_deleted_by_user: { label: "Excluído pelo usuário", tone: "destructive" },
  account_deleted_by_admin: { label: "Excluído pelo admin", tone: "destructive" },
  session_revoked: { label: "Sessão revogada", tone: "secondary" },
  all_sessions_revoked: { label: "Todas sessões revogadas", tone: "secondary" },
  impersonation_started: { label: "Impersonate iniciado", tone: "destructive" },
  impersonation_stopped: { label: "Impersonate encerrado", tone: "outline" },
  bulk_action: { label: "Ação em lote", tone: "secondary" },
  update: { label: "Atualização", tone: "outline" },
  create: { label: "Criação", tone: "outline" },
  delete: { label: "Exclusão", tone: "destructive" },
  export: { label: "Exportação", tone: "outline" },
};

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

export function AuditLogList({ userId }: Props) {
  const { data, isLoading } = useQuery<{ data: AuditLogEntry[] }>({
    queryKey: ["admin", "audit-logs", userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        userId: String(userId),
        limit: "50",
        page: "1",
      });
      const res = await fetch(`/api/admin-panel/audit-logs?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao carregar histórico");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando histórico...
      </div>
    );
  }

  const entries = data?.data ?? [];

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Sem histórico de auditoria.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((e) => {
        const meta = ACTION_LABEL[e.action] ?? { label: e.action, tone: "outline" as const };
        return (
          <li key={e.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <Badge variant={meta.tone}>{meta.label}</Badge>
              <span className="text-xs text-muted-foreground">{fmtDate(e.createdAt)}</span>
            </div>
            <div className="mt-1 text-muted-foreground text-xs">
              {e.actorFullName ? `Por ${e.actorFullName}` : "Sistema"}
              {e.ipAddress ? ` · ${e.ipAddress}` : ""}
              {e.resourceId ? ` · ${e.resourceType}#${e.resourceId}` : ""}
            </div>
            {e.details && Object.keys(e.details).length > 0 && (
              <pre className="mt-2 text-xs bg-muted/40 p-2 rounded overflow-x-auto">
                {JSON.stringify(e.details, null, 2)}
              </pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}
