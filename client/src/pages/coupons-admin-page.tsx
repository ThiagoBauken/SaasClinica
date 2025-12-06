import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Trash2, Edit, TrendingUp, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Coupon {
  id: number;
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  planIds: number[] | null;
  isActive: boolean;
  createdAt: string;
}

interface Plan {
  id: number;
  name: string;
  displayName: string;
}

export default function CouponsAdminPage() {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    maxUses: "",
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: "",
    planIds: [] as number[],
  });

  // Buscar cupons
  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["/api/v1/coupons"],
    queryFn: async () => {
      const response = await fetch("/api/v1/coupons");
      if (!response.ok) throw new Error("Erro ao carregar cupons");
      return response.json();
    },
  });

  // Buscar planos
  const { data: plans = [] } = useQuery({
    queryKey: ["/api/billing/plans"],
    queryFn: async () => {
      const response = await fetch("/api/billing/plans");
      if (!response.ok) throw new Error("Erro ao carregar planos");
      return response.json();
    },
  });

  // Mutation para criar cupom
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/v1/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: data.code.toUpperCase(),
          description: data.description,
          discountType: data.discountType,
          discountValue: parseFloat(data.discountValue),
          maxUses: data.maxUses ? parseInt(data.maxUses) : null,
          validFrom: new Date(data.validFrom),
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          planIds: data.planIds.length > 0 ? data.planIds : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar cupom");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/coupons"] });
      setOpenDialog(false);
      resetForm();
      toast({
        title: "Sucesso",
        description: "Cupom criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para desativar cupom
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/v1/coupons/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao desativar cupom");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/coupons"] });
      toast({
        title: "Sucesso",
        description: "Cupom desativado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: "",
      maxUses: "",
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: "",
      planIds: [],
    });
    setEditingCoupon(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discountType === "percentage") {
      return `${coupon.discountValue}%`;
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(coupon.discountValue));
  };

  const getUsagePercent = (coupon: Coupon) => {
    if (!coupon.maxUses) return 0;
    return (coupon.usedCount / coupon.maxUses) * 100;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Tag className="h-8 w-8 text-primary" />
            Gestão de Cupons
          </h1>
          <p className="text-muted-foreground mt-2">
            Crie e gerencie cupons de desconto para suas assinaturas
          </p>
        </div>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Cupom</DialogTitle>
              <DialogDescription>
                Preencha os dados do cupom de desconto
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="code">Código do Cupom *</Label>
                <Input
                  id="code"
                  placeholder="Ex: PROMO20, BLACKFRIDAY"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  placeholder="Descrição do cupom"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discountType">Tipo de Desconto *</Label>
                  <Select
                    value={formData.discountType}
                    onValueChange={(value: "percentage" | "fixed") =>
                      setFormData({ ...formData, discountType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="discountValue">
                    Valor {formData.discountType === "percentage" ? "(%)" : "(R$)"} *
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    step="0.01"
                    placeholder={formData.discountType === "percentage" ? "10" : "50.00"}
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData({ ...formData, discountValue: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="maxUses">Limite de Usos</Label>
                <Input
                  id="maxUses"
                  type="number"
                  placeholder="Deixe vazio para ilimitado"
                  value={formData.maxUses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUses: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="validFrom">Válido a partir de *</Label>
                  <Input
                    id="validFrom"
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) =>
                      setFormData({ ...formData, validFrom: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="validUntil">Válido até</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) =>
                      setFormData({ ...formData, validUntil: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Planos Válidos (deixe vazio para todos)</Label>
                <div className="space-y-2 mt-2">
                  {plans.map((plan: Plan) => (
                    <label key={plan.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.planIds.includes(plan.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              planIds: [...formData.planIds, plan.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              planIds: formData.planIds.filter((id) => id !== plan.id),
                            });
                          }
                        }}
                      />
                      {plan.displayName}
                    </label>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Cupom"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cupons</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coupons.length}</div>
            <p className="text-xs text-muted-foreground">
              {coupons.filter((c: Coupon) => c.isActive).length} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coupons.reduce((acc: number, c: Coupon) => acc + c.usedCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Aplicações de cupons</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desconto Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coupons.filter((c: Coupon) => c.isActive).length > 0
                ? `${coupons.filter((c: Coupon) => c.isActive).length} cupons`
                : "Nenhum"}
            </div>
            <p className="text-xs text-muted-foreground">Cupons disponíveis</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Cupons */}
      <Card>
        <CardHeader>
          <CardTitle>Cupons Cadastrados</CardTitle>
          <CardDescription>
            Gerencie todos os cupons de desconto do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando cupons...
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cupom cadastrado ainda
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon: Coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <div>
                        <div className="font-bold">{coupon.code}</div>
                        {coupon.description && (
                          <div className="text-sm text-muted-foreground">
                            {coupon.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatDiscount(coupon)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          {coupon.usedCount}
                          {coupon.maxUses && ` / ${coupon.maxUses}`}
                        </div>
                        {coupon.maxUses && (
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${Math.min(getUsagePercent(coupon), 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(coupon.validFrom), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </div>
                        {coupon.validUntil && (
                          <div className="text-muted-foreground">
                            até{" "}
                            {format(new Date(coupon.validUntil), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {coupon.isActive ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(coupon.id)}
                        disabled={!coupon.isActive}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
