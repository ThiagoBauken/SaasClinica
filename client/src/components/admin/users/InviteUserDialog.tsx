import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCsrfHeaders } from "@/lib/csrf";

type InviteRole = "dentista" | "recepcionista" | "assistente" | "staff" | "admin";

interface Props {
  trigger?: React.ReactNode;
}

export function InviteUserDialog({ trigger }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("staff");
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/team/invite", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao enviar convite");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Convite enviado", description: `Um e-mail foi enviado para ${email}.` });
      setAcceptUrl(data.acceptUrl ?? null);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const reset = () => {
    setEmail("");
    setRole("staff");
    setAcceptUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar
        </Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Convidar novo usuário
          </DialogTitle>
          <DialogDescription>
            O usuário receberá um link por e-mail para criar a própria senha.
          </DialogDescription>
        </DialogHeader>

        {acceptUrl ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Convite enviado. Você também pode compartilhar o link manualmente:
            </p>
            <Input readOnly value={acceptUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">E-mail do convidado</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Função inicial</Label>
              <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Equipe</SelectItem>
                  <SelectItem value="dentista">Dentista</SelectItem>
                  <SelectItem value="recepcionista">Recepção</SelectItem>
                  <SelectItem value="assistente">Assistente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {acceptUrl ? (
            <Button onClick={() => { setOpen(false); reset(); }}>Fechar</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!email || mutation.isPending}
              >
                {mutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                ) : "Enviar convite"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
