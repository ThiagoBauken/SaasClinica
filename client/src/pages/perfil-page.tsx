import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/core/AuthProvider";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCsrfHeaders } from "@/lib/csrf";
import { Loader2, User, Mail, Phone, Save, Camera, ShieldCheck, ShieldOff, Copy, KeyRound } from "lucide-react";

export default function PerfilPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [speciality, setSpeciality] = useState(user?.speciality || "");

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { fullName: string; email: string; phone: string; speciality: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao atualizar perfil");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ fullName, email, phone, speciality });
  };

  return (
    <DashboardLayout title="Meu Perfil" currentPath="/perfil">
      <div className="container mx-auto py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Meu Perfil
            </CardTitle>
            <CardDescription>
              Gerencie suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.profileImageUrl || ""} alt={user?.fullName || "User"} />
                  <AvatarFallback className="text-2xl">
                    {user?.fullName?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{user?.fullName}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{user?.role || "Usuário"}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    type="button"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append("avatar", file);
                        try {
                          const csrfHeaders = getCsrfHeaders();
                          const res = await fetch("/api/v1/profile/avatar", {
                            method: "POST",
                            credentials: "include",
                            headers: csrfHeaders,
                            body: formData,
                          });
                          if (res.ok) {
                            window.location.reload();
                          }
                        } catch {
                          // silently fail - toast would be better but keeping it simple
                        }
                      };
                      input.click();
                    }}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Alterar foto
                  </Button>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      placeholder="Seu nome completo"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="speciality">Especialidade</Label>
                  <Input
                    id="speciality"
                    value={speciality}
                    onChange={(e) => setSpeciality(e.target.value)}
                    placeholder="Ex: Ortodontia, Implantodontia, etc."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Seção MFA / Autenticação em duas etapas */}
        <MfaSection />
      </div>
    </DashboardLayout>
  );
}

// ============================================================
// MFA Configuration Section
// ============================================================
function MfaSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'idle' | 'setup' | 'confirm' | 'disable'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState('');

  const isMfaEnabled = (user as any)?.totpEnabled === true;

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/totp/setup', {
        method: 'POST',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao configurar MFA');
      return res.json();
    },
    onSuccess: (data) => {
      setQrCodeUrl(data.qrCodeUrl);
      setSecret(data.secret);
      setStep('confirm');
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch('/api/auth/totp/confirm', {
        method: 'POST',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Código inválido');
      return res.json();
    },
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes || []);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({ title: 'MFA ativado!', description: 'Salve os códigos de backup em local seguro.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ password }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao desativar MFA');
      return res.json();
    },
    onSuccess: () => {
      setStep('idle');
      setDisablePassword('');
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({ title: 'MFA desativado', description: 'A autenticação em duas etapas foi desativada.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast({ title: 'Copiado!', description: 'Códigos de backup copiados para a área de transferência.' });
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Autenticação em Duas Etapas (MFA)
        </CardTitle>
        <CardDescription>
          Adicione uma camada extra de segurança à sua conta usando um app autenticador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Estado: MFA ativado */}
        {isMfaEnabled && step !== 'disable' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">MFA ativo</p>
                <p className="text-sm text-green-600 dark:text-green-400">Sua conta está protegida com autenticação em duas etapas.</p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setStep('disable')}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Desativar MFA
            </Button>
          </div>
        )}

        {/* Estado: Desativar MFA */}
        {step === 'disable' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Digite sua senha para confirmar a desativação do MFA:</p>
            <Input
              type="password"
              placeholder="Sua senha atual"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => disableMutation.mutate(disablePassword)}
                disabled={!disablePassword || disableMutation.isPending}
              >
                {disableMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar desativação
              </Button>
              <Button variant="outline" onClick={() => { setStep('idle'); setDisablePassword(''); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Estado: MFA não ativado — botão para iniciar */}
        {!isMfaEnabled && step === 'idle' && (
          <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
            {setupMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Ativar MFA
          </Button>
        )}

        {/* Estado: Confirmar setup — QR code + input de código */}
        {step === 'confirm' && !backupCodes.length && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Escaneie o QR code abaixo com seu app autenticador (Google Authenticator, Authy, etc.):
              </p>
              <div className="inline-block p-4 bg-white rounded-lg border">
                <img src={qrCodeUrl} alt="QR Code MFA" className="w-48 h-48 mx-auto" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Ou insira manualmente: <code className="bg-muted px-2 py-0.5 rounded text-xs">{secret}</code>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Digite o código de 6 dígitos do app:</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-xl tracking-[0.3em] font-mono max-w-xs"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => confirmMutation.mutate(confirmCode)}
                disabled={confirmCode.length < 6 || confirmMutation.isPending}
              >
                {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar e ativar
              </Button>
              <Button variant="outline" onClick={() => { setStep('idle'); setConfirmCode(''); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Estado: Backup codes — mostrar uma vez */}
        {backupCodes.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                Salve seus códigos de backup!
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                Estes códigos permitem acessar sua conta se perder o app autenticador. Cada código pode ser usado apenas uma vez.
              </p>
              <div className="grid grid-cols-2 gap-1 font-mono text-sm bg-white dark:bg-gray-900 p-3 rounded border">
                {backupCodes.map((code, i) => (
                  <div key={i} className="py-0.5">{code}</div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyBackupCodes}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar códigos
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setBackupCodes([]);
                  setStep('idle');
                  setConfirmCode('');
                  setSecret('');
                  setQrCodeUrl('');
                }}
              >
                Pronto, já salvei
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
