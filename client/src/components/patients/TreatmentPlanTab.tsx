import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, CheckCircle, FileText, Loader2, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TreatmentPlanTabProps {
  patientId: number;
}

export default function TreatmentPlanTab({ patientId }: TreatmentPlanTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pending",
    estimatedCost: "",
  });

  const { data: plans = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/treatment-plans`],
    enabled: !!patientId,
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        estimatedCost: data.estimatedCost ? Math.round(parseFloat(data.estimatedCost) * 100) : 0,
        patientId
      };
      const res = await apiRequest("POST", `/api/patients/${patientId}/treatment-plans`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/treatment-plans`] });
      toast({ title: "Sucesso", description: "Plano de tratamento criado com sucesso." });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const payload = {
        ...data,
        estimatedCost: data.estimatedCost ? Math.round(parseFloat(data.estimatedCost) * 100) : 0,
      };
      const res = await apiRequest("PATCH", `/api/patients/${patientId}/treatment-plans/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/treatment-plans`] });
      toast({ title: "Sucesso", description: "Plano atualizado com sucesso." });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      status: "pending",
      estimatedCost: "",
    });
    setEditingPlan(null);
  };

  const handleOpenDialog = (plan?: any) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        title: plan.title || "",
        description: plan.description || "",
        status: plan.status || "pending",
        estimatedCost: plan.estimatedCost ? (plan.estimatedCost / 100).toFixed(2) : "",
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title) {
      toast({ title: "Aviso", description: "O nome do plano é obrigatório", variant: "destructive" });
      return;
    }
    
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createPlanMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Planos de Tratamento e Orçamentos</CardTitle>
          <CardDescription>
            Crie e gerencie os planos de tratamento do paciente.
          </CardDescription>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </CardHeader>
      <CardContent>
        {plans.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Nenhum plano de tratamento registrado para este paciente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan: any) => (
              <div key={plan.id} className="border rounded-lg p-5 bg-card hover:bg-accent/5 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-lg font-medium">{plan.title}</h4>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={
                        plan.status === "completed" ? "default" :
                        plan.status === "approved" ? "secondary" : 
                        plan.status === "rejected" ? "destructive" : "outline"
                      }>
                        {plan.status === "approved" ? "Aprovado" : 
                         plan.status === "completed" ? "Concluído" : 
                         plan.status === "rejected" ? "Recusado" : "Pendente"}
                      </Badge>
                      {plan.estimatedCost && (
                         <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                           <DollarSign className="h-3 w-3 mr-1" />
                           R$ {(Number(plan.estimatedCost) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                         </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(plan)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-2 bg-muted/30 p-3 rounded">
                    {plan.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar Plano" : "Novo Plano de Tratamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Plano *</Label>
              <Input 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Ex: Reabilitação Estética Superior"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Descrição / Procedimentos</Label>
              <Textarea 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Detalhes dos procedimentos, etapas..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo Estimado (R$)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData({...formData, estimatedCost: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="pending">Pendente (Orçamento)</option>
                  <option value="approved">Aprovado</option>
                  <option value="completed">Concluído</option>
                  <option value="rejected">Recusado</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
            >
              {(createPlanMutation.isPending || updatePlanMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
