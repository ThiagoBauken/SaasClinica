import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, ClockIcon, UserIcon } from "lucide-react";

export default function NovoAgendamento() {
  const [formData, setFormData] = useState({
    paciente: "",
    telefone: "",
    data: "",
    horario: "",
    procedimento: "",
    observacoes: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Novo agendamento:", formData);
    // Aqui implementaria a lógica de salvamento
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Novo Agendamento
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
              <Button type="submit" className="flex-1">
                Agendar Consulta
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