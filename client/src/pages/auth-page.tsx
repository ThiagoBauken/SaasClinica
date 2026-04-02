import { useState, useCallback, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/core/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";

const loginSchema = insertUserSchema.pick({
  username: true,
  password: true,
}).extend({
  rememberMe: z.boolean().optional(),
});

const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const { user, loginMutation, registerMutation, mfaState, verifyTotp, cancelMfa } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);
  const totpInputRef = useRef<HTMLInputElement>(null);

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Falha ao solicitar recuperação de senha");
      return res.json();
    },
    onSuccess: (data) => {
      setForgotPasswordSent(true);
      toast({
        title: "Email enviado",
        description: data.message || "Verifique seu email para as instruções de recuperação.",
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

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      role: "staff",
      email: "",
      phone: "",
      speciality: "",
    },
  });

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      await loginMutation.mutate(values);
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message || "Credenciais inválidas. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const onRegisterSubmit = async (values: z.infer<typeof registerSchema>) => {
    try {
      const { confirmPassword, ...registerData } = values;
      await registerMutation.mutate(registerData);
    } catch (error: any) {
      toast({
        title: "Erro no registro",
        description: error.message || "Falha no registro. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length < 6) {
      setTotpError("Digite o código de 6 dígitos");
      return;
    }
    setTotpError("");
    setIsVerifyingTotp(true);
    try {
      await verifyTotp(totpCode);
    } catch (error: any) {
      setTotpError(error.message || "Código inválido");
      setTotpCode("");
      totpInputRef.current?.focus();
    } finally {
      setIsVerifyingTotp(false);
    }
  };

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/dashboard" />;
  }

  // MFA: Mostrar tela de verificação TOTP
  if (mfaState?.required) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <ShieldCheck className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl">Verificação em duas etapas</CardTitle>
            <CardDescription>
              Abra seu app autenticador e digite o código de 6 dígitos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  ref={totpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => {
                    setTotpCode(e.target.value.replace(/\D/g, ''));
                    setTotpError("");
                  }}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                  autoComplete="one-time-code"
                />
                {totpError && (
                  <p className="text-sm text-destructive text-center">{totpError}</p>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Ou digite um código de backup
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isVerifyingTotp || totpCode.length < 6}>
                {isVerifyingTotp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : "Verificar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  cancelMfa();
                  setTotpCode("");
                  setTotpError("");
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDM0djItMnptMCAwdjJoLTJ2LTJoMnptLTIgMmgtMnYtMmgydjJ6bTIgMGgydjJoLTJ2LTJ6bTAgMnYyaC0ydi0yaDJ6bS0yIDB2Mmg tMnYtMmgyem0yLTJoMnYyaC0ydi0yem0wLTJ2Mmgtdi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40 dark:opacity-20"></div>

      {/* Theme Toggle - canto superior direito */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-6xl flex flex-col lg:flex-row bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Left side - Auth forms */}
        <div className="w-full lg:w-1/2 p-6 sm:p-8 md:p-10 lg:p-12">
          <div className="mb-8 md:mb-10">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              DentCare
            </h1>
            <p className="text-muted-foreground mt-3 text-base md:text-lg">
              Sistema de Gerenciamento Odontológico
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Registrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-0 shadow-none bg-transparent">
                <CardHeader className="pb-6">
                  <CardTitle className="text-2xl md:text-3xl">Acesse sua conta</CardTitle>
                  <CardDescription className="text-base">
                    Informe suas credenciais para entrar no sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form
                      onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                      action="/api/auth/login"
                      method="POST"
                      className="space-y-4"
                    >
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Usuário</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Seu nome de usuário"
                                autoComplete="username"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showLoginPassword ? "text" : "password"}
                                  placeholder="Sua senha"
                                  autoComplete="current-password"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                                >
                                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-center justify-between">
                        <FormField
                          control={loginForm.control}
                          name="rememberMe"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={field.onChange}
                                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal cursor-pointer">
                                Manter conectado
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              className="text-sm text-primary hover:underline"
                            >
                              Esqueceu a senha?
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Recuperar senha</DialogTitle>
                              <DialogDescription>
                                {forgotPasswordSent
                                  ? "Um email foi enviado com as instruções para recuperar sua senha."
                                  : "Informe seu email para receber as instruções de recuperação de senha."
                                }
                              </DialogDescription>
                            </DialogHeader>
                            {!forgotPasswordSent ? (
                              <div className="space-y-4 pt-4">
                                <Input
                                  type="email"
                                  placeholder="Seu e-mail"
                                  value={forgotPasswordEmail}
                                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                                />
                                <Button
                                  className="w-full"
                                  onClick={() => forgotPasswordMutation.mutate(forgotPasswordEmail)}
                                  disabled={!forgotPasswordEmail || forgotPasswordMutation.isPending}
                                >
                                  {forgotPasswordMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Enviando...
                                    </>
                                  ) : "Enviar instruções"}
                                </Button>
                              </div>
                            ) : (
                              <div className="pt-4">
                                <Button
                                  className="w-full"
                                  onClick={() => {
                                    setForgotPasswordOpen(false);
                                    setForgotPasswordSent(false);
                                    setForgotPasswordEmail("");
                                  }}
                                >
                                  Fechar
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Entrando...
                          </>
                        ) : "Entrar"}
                      </Button>
                      
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-neutral-light"></span>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-card text-muted-foreground">ou continue com</span>
                        </div>
                      </div>
                      
                      <a href="/auth/google" className="w-full">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Entrar com Google
                        </Button>
                      </a>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <p className="text-sm text-neutral-medium">
                    Não tem uma conta?{" "}
                    <button
                      className="text-primary hover:underline"
                      onClick={() => setActiveTab("register")}
                    >
                      Registre-se
                    </button>
                  </p>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-0 shadow-none bg-transparent">
                <CardHeader className="pb-6">
                  <CardTitle className="text-2xl md:text-3xl">Crie sua conta</CardTitle>
                  <CardDescription className="text-base">
                    Preencha os dados abaixo para se registrar no sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Usuário</FormLabel>
                            <FormControl>
                              <Input placeholder="Escolha um nome de usuário" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                              <Input placeholder="Seu nome completo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="Seu e-mail" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Senha</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showRegisterPassword ? "text" : "password"}
                                    placeholder="Crie uma senha"
                                    {...field}
                                  />
                                  <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                  >
                                    {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirmar Senha</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirme sua senha"
                                    {...field}
                                  />
                                  <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Registrando...
                          </>
                        ) : "Registrar"}
                      </Button>
                      
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-neutral-light"></span>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-card text-muted-foreground">ou continue com</span>
                        </div>
                      </div>
                      
                      <a href="/auth/google" className="w-full">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Registrar com Google
                        </Button>
                      </a>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <p className="text-sm text-neutral-medium">
                    Já tem uma conta?{" "}
                    <button
                      className="text-primary hover:underline"
                      onClick={() => setActiveTab("login")}
                    >
                      Entrar
                    </button>
                  </p>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right side - Image and info */}
        <div className="w-full lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 p-8 md:p-10 lg:p-12 text-white hidden lg:flex flex-col justify-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

          <div className="relative z-10">
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Gerencie sua clínica odontológica</h2>
              <p className="mb-4 text-lg opacity-95">
                Uma solução completa para o gerenciamento eficiente de sua clínica odontológica, com:
              </p>
              <ul className="space-y-3 text-base">
                <li className="flex items-start">
                  <svg className="w-6 h-6 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Agenda completa com visualização diária, semanal e mensal</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Prontuário eletrônico e odontograma digital interativo</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Controle financeiro e gestão de receitas e despesas</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Automação via WhatsApp e confirmação de consultas</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>CRM integrado com pipeline de vendas e atendimento</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-xl">DentCare SaaS</p>
                  <p className="text-sm opacity-90">Plataforma em nuvem</p>
                </div>
              </div>
              <p className="text-sm opacity-90 leading-relaxed">
                Transformando o gerenciamento odontológico para melhorar a experiência de
                profissionais e pacientes com tecnologia de ponta.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
