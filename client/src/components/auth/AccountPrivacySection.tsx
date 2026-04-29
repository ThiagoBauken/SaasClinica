import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/core/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { getCsrfHeaders } from "@/lib/csrf";

export function AccountPrivacySection() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/account/export", {
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Falha ao exportar dados.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dentcare-export-user-${user?.id ?? "me"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "Exportação concluída",
        description: "Seus dados foram baixados em formato JSON.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/account/delete", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ password: confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao excluir conta.");
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Conta encerrada",
        description: "Sua conta foi desativada. Você será desconectado.",
      });
      setConfirmOpen(false);
      // Logout limpa cookies e sessão local; em seguida redireciona pra /auth.
      logout();
    },
    onError: (err: Error) => {
      toast({
        title: "Não foi possível excluir",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Privacidade e meus dados
        </CardTitle>
        <CardDescription>
          Direitos garantidos pela LGPD: exportação e exclusão da sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="flex-1">
            <h3 className="font-medium mb-1">Exportar meus dados</h3>
            <p className="text-sm text-muted-foreground">
              Baixe um arquivo JSON com seus dados de usuário e a identificação da
              empresa que você administra. Para exportações clínicas completas
              (pacientes, prontuários), entre em contato com o suporte.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar dados
              </>
            )}
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex-1">
            <h3 className="font-medium mb-1 text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Excluir minha conta
            </h3>
            <p className="text-sm text-muted-foreground">
              Encerra seu acesso e desativa o login. Os dados clínicos da clínica
              permanecem para fins legais até serem removidos pelo suporte.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir conta
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar exclusão
            </DialogTitle>
            <DialogDescription>
              Esta ação encerra seu acesso imediatamente. Para confirmar, digite{" "}
              <strong>EXCLUIR</strong> e informe sua senha atual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="confirm-text">Digite EXCLUIR</Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="EXCLUIR"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Sua senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Senha atual"
                autoComplete="current-password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText("");
                setConfirmPassword("");
              }}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={
                deleteMutation.isPending ||
                confirmText !== "EXCLUIR" ||
                confirmPassword.length < 1
              }
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir definitivamente"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
