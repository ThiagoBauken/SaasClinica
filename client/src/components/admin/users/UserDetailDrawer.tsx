import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldOff, Lock, MailCheck, UserX, UserCheck, LogIn, Save } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getCsrfHeaders } from "@/lib/csrf";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SessionsList } from "./SessionsList";
import { AuditLogList } from "./AuditLogList";
import type { AdminUser } from "./types";

interface Props {
  user: AdminUser | null;
  onClose: () => void;
  invalidateKey: unknown[];
  /** É o admin atual. Usado pra esconder ações destrutivas em si mesmo. */
  currentUserId: number;
  isSuperadmin: boolean;
}

export function UserDetailDrawer({
  user,
  onClose,
  invalidateKey,
  currentUserId,
  isSuperadmin,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("data");
  const [confirm, setConfirm] = useState<null | "reset-mfa" | "delete">(null);

  // Form state — recriado quando user muda
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("staff");
  const [active, setActive] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? "");
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
    setRole(user.role ?? "staff");
    setActive(user.active);
    setAdminNotes(user.adminNotes ?? "");
    setTab("data");
  }, [user?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const res = await fetch(`/api/admin-panel/users/${user.id}`, {
        method: "PATCH",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ fullName, email, phone: phone || null, role, active, adminNotes: adminNotes || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao salvar");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Salvo" });
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const action = (path: string, opts?: RequestInit) =>
    fetch(path, { method: "POST", headers: getCsrfHeaders(), credentials: "include", ...opts });

  const unlockMutation = useMutation({
    mutationFn: () => action(`/api/admin-panel/users/${user!.id}/unlock`).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "Conta desbloqueada" });
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
  });

  const resetMfaMutation = useMutation({
    mutationFn: () =>
      action(`/api/admin-panel/users/${user!.id}/reset-mfa`, {
        headers: getCsrfHeaders({ "x-confirm": "true" }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "MFA resetado" });
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      setConfirm(null);
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const markVerifiedMutation = useMutation({
    mutationFn: () => action(`/api/admin-panel/users/${user!.id}/mark-verified`).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "E-mail marcado como verificado" });
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async () => {
      const res = await action(`/api/admin-panel/users/${user!.id}/impersonate`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao impersonar");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Você está vendo como o usuário", description: "Banner vermelho indicará o estado." });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      onClose();
      // Recarrega a app para refletir o novo contexto
      window.location.href = "/dashboard";
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin-panel/users/${user!.id}`, {
        method: "DELETE",
        headers: getCsrfHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Falha ao excluir");
      }
    },
    onSuccess: () => {
      toast({ title: "Usuário excluído" });
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      setConfirm(null);
      onClose();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  if (!user) return null;
  const isSelf = user.id === currentUserId;
  const isLockedNow = user.lockedUntil && new Date(user.lockedUntil) > new Date();
  const canImpersonate = isSuperadmin && !isSelf && user.role !== "superadmin";

  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{user.fullName}</SheetTitle>
          <SheetDescription>
            @{user.username} · {user.email}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="data">Dados</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
            <TabsTrigger value="sessions">Sessões</TabsTrigger>
            <TabsTrigger value="audit">Histórico</TabsTrigger>
            <TabsTrigger value="notes">Notas</TabsTrigger>
          </TabsList>

          {/* DADOS */}
          <TabsContent value="data" className="space-y-4 mt-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Nome completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Função</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="dentist">Dentista</SelectItem>
                    <SelectItem value="staff">Equipe</SelectItem>
                    <SelectItem value="receptionist">Recepção</SelectItem>
                    <SelectItem value="assistant">Assistente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Conta ativa</Label>
                  <p className="text-xs text-muted-foreground">Usuário pode fazer login.</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} disabled={isSelf} />
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar alterações
              </Button>
            </div>
          </TabsContent>

          {/* SEGURANÇA */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="rounded-md border p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">E-mail verificado</p>
                  <p className="text-xs text-muted-foreground">{user.emailVerified ? "Sim" : "Não"}</p>
                </div>
                {!user.emailVerified && (
                  <Button size="sm" variant="outline" onClick={() => markVerifiedMutation.mutate()}>
                    <MailCheck className="h-4 w-4 mr-1" />
                    Marcar como verificado
                  </Button>
                )}
              </div>

              <div className="rounded-md border p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">Autenticação em duas etapas (MFA)</p>
                  <p className="text-xs text-muted-foreground">
                    {user.totpEnabled ? "Habilitada" : "Desabilitada"}
                  </p>
                </div>
                {user.totpEnabled && (
                  <Button size="sm" variant="destructive" onClick={() => setConfirm("reset-mfa")}>
                    <ShieldOff className="h-4 w-4 mr-1" />
                    Resetar MFA
                  </Button>
                )}
              </div>

              <div className="rounded-md border p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">Bloqueio por falhas</p>
                  <p className="text-xs text-muted-foreground">
                    {isLockedNow
                      ? `Bloqueado até ${new Date(user.lockedUntil!).toLocaleString("pt-BR")}`
                      : `Falhas: ${user.failedLoginCount}`}
                  </p>
                </div>
                {(isLockedNow || user.failedLoginCount > 0) && (
                  <Button size="sm" variant="outline" onClick={() => unlockMutation.mutate()}>
                    <Lock className="h-4 w-4 mr-1" />
                    Desbloquear
                  </Button>
                )}
              </div>

              {canImpersonate && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Acessar como este usuário</p>
                    <p className="text-xs text-muted-foreground">
                      Usado para suporte. Todas as ações ficam registradas em auditoria.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => impersonateMutation.mutate()} disabled={impersonateMutation.isPending}>
                    <LogIn className="h-4 w-4 mr-1" />
                    Impersonar
                  </Button>
                </div>
              )}

              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Excluir conta</p>
                  <p className="text-xs text-muted-foreground">
                    Marca como excluído e revoga todas as sessões.
                  </p>
                </div>
                {user.role !== "superadmin" && !isSelf && (
                  <Button size="sm" variant="destructive" onClick={() => setConfirm("delete")}>
                    <UserX className="h-4 w-4 mr-1" />
                    Excluir
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* SESSÕES */}
          <TabsContent value="sessions" className="mt-4">
            <SessionsList userId={user.id} />
          </TabsContent>

          {/* AUDIT */}
          <TabsContent value="audit" className="mt-4">
            <AuditLogList userId={user.id} />
          </TabsContent>

          {/* NOTAS */}
          <TabsContent value="notes" className="space-y-3 mt-4">
            <Label>Notas internas (visíveis só a admins)</Label>
            <Textarea
              rows={8}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Anotações de suporte, contexto de cliente, observações…"
            />
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Salvar notas
            </Button>
          </TabsContent>
        </Tabs>

        <ConfirmDialog
          open={confirm === "reset-mfa"}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Resetar MFA"
          description="O usuário precisará configurar a autenticação em duas etapas novamente. Os códigos de backup serão invalidados."
          variant="destructive"
          confirmLabel="Resetar"
          onConfirm={() => resetMfaMutation.mutate()}
          loading={resetMfaMutation.isPending}
        />
        <ConfirmDialog
          open={confirm === "delete"}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Excluir usuário"
          description="A conta será desativada, soft-deleted e todas as sessões serão revogadas. Esta ação é registrada na auditoria."
          requireText="EXCLUIR"
          variant="destructive"
          confirmLabel="Excluir definitivamente"
          onConfirm={() => deleteMutation.mutate()}
          loading={deleteMutation.isPending}
        />
      </SheetContent>
    </Sheet>
  );
}
