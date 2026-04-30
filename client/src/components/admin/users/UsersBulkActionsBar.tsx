import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Power, PowerOff, ShieldOff, KeyRound, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getCsrfHeaders } from "@/lib/csrf";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type BulkAction = "activate" | "deactivate" | "delete" | "reset-mfa" | "unlock";

interface Props {
  selectedIds: number[];
  onClear: () => void;
  /** queryKey base para invalidar a listagem após sucesso. */
  invalidateKey: unknown[];
}

const ACTION_LABEL: Record<BulkAction, string> = {
  activate: "Ativar",
  deactivate: "Desativar",
  delete: "Excluir",
  "reset-mfa": "Resetar MFA",
  unlock: "Desbloquear",
};

export function UsersBulkActionsBar({ selectedIds, onClear, invalidateKey }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);

  const mutation = useMutation({
    mutationFn: async (action: BulkAction) => {
      const res = await fetch("/api/admin-panel/users/bulk", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ ids: selectedIds, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha na operação em lote");
      return data;
    },
    onSuccess: (data, action) => {
      toast({
        title: "Concluído",
        description: `${data.affected} usuário(s) afetado(s) por "${ACTION_LABEL[action]}".`,
      });
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      onClear();
      setPendingAction(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setPendingAction(null);
    },
  });

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-lg">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{selectedIds.length}</span> selecionado(s)
          <Button size="sm" variant="ghost" onClick={onClear}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPendingAction("activate")}>
            <Power className="h-4 w-4 mr-1" />
            Ativar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPendingAction("deactivate")}>
            <PowerOff className="h-4 w-4 mr-1" />
            Desativar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPendingAction("unlock")}>
            <KeyRound className="h-4 w-4 mr-1" />
            Desbloquear
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPendingAction("reset-mfa")}>
            <ShieldOff className="h-4 w-4 mr-1" />
            Resetar MFA
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setPendingAction("delete")}>
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={(o) => !o && setPendingAction(null)}
        title={`${pendingAction ? ACTION_LABEL[pendingAction] : ""} ${selectedIds.length} usuário(s)`}
        description={
          pendingAction === "delete"
            ? "Esta ação marca os usuários como excluídos e revoga todas as sessões. Não pode ser desfeita."
            : `Confirma aplicar "${pendingAction ? ACTION_LABEL[pendingAction] : ""}" aos usuários selecionados?`
        }
        requireText={pendingAction === "delete" ? "EXCLUIR" : undefined}
        variant={pendingAction === "delete" ? "destructive" : "default"}
        confirmLabel={pendingAction ? ACTION_LABEL[pendingAction] : "Confirmar"}
        loading={mutation.isPending}
        onConfirm={() => {
          if (pendingAction) mutation.mutate(pendingAction);
        }}
      />
    </>
  );
}
