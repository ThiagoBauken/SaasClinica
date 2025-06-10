import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, ClockIcon, UserIcon, EditIcon } from "lucide-react";

interface EditarAgendamentoProps {
  agendamentoId?: string;
}

export default function EditarAgendamento({ agendamentoId }: EditarAgendamentoProps) {
  const [formData, setFormData] = useState({
    paciente: "",
    telefone: "",
    data: "",
    horario: "",
    procedimento: "",
    observacoes: "",
    status: "agendado"
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (agendamentoId) {
      // Simular carregamento dos dados do agendamento
      setFormData({
        paciente: "Maria Silva",
        telefone: "(11) 99999-9999",
        data: "2024-01-15",
        horario: "14:30",
        procedimento: "Limpeza",
        observacoes: "Paciente com sensibilidade",
        status: "agendado"
      });
    }
  }, [agendamentoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      console.log("Editando agendamento:", formData);
      // Aqui implementaria a lógica de atualização
      setTimeout(() => {
        setIsLoading(false);
        alert("Agendamento atualizado com sucesso!");
      }, 1000);
    } catch (error) {
      setIsLoading(false);
      console.error("Erro ao atualizar:", error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EditIcon className="h-5 w-5" />
            Editar Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paciente" className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Paciente
                </Label>
                <Input
                  id="paciente"
                  value={formData.paciente}
                  onChange={(e) => handleChange("paciente", e.target.value)}
                  placeholder="Nome do paciente"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleChange("telefone", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => handleChange("data", e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="horario" className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4" />
                  Horário
                </Label>
                <Input
                  id="horario"
                  type="time"
                  value={formData.horario}
                  onChange={(e) => handleChange("horario", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="procedimento">Procedimento</Label>
                <Input
                  id="procedimento"
                  value={formData.procedimento}
                  onChange={(e) => handleChange("procedimento", e.target.value)}
                  placeholder="Ex: Limpeza, Restauração, Canal..."
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="em-andamento">Em Andamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => handleChange("observacoes", e.target.value)}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button type="button" variant="outline" className="flex-1">
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}