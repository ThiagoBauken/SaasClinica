/**
 * Componente de Alertas de Risco Clínico
 *
 * Exibe badges visuais com alertas importantes do paciente
 * (alergias, cardiopatias, diabetes, anticoagulantes, etc.)
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Heart,
  Pill,
  Baby,
  Droplet,
  ShieldAlert,
  Syringe,
  Activity,
  Plus,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface RiskAlert {
  id: number;
  code: string;
  name: string;
  color: string;
  icon: string;
  severity: string;
  details: string | null;
  notes: string | null;
  clinicalWarning: string | null;
  detectedAt: string;
}

interface RiskAlertType {
  id: number;
  code: string;
  name: string;
  color: string;
  icon: string;
  severity: string;
  clinicalWarning: string | null;
}

interface PatientRiskAlertsProps {
  patientId: number;
  compact?: boolean; // Modo compacto para lista de pacientes
  showAddButton?: boolean;
  onAlertsChange?: () => void;
}

// Mapa de ícones por código
const iconMap: Record<string, React.ReactNode> = {
  allergy: <Pill className="h-3 w-3" />,
  cardiac: <Heart className="h-3 w-3" />,
  diabetes: <Droplet className="h-3 w-3" />,
  anticoagulant: <Syringe className="h-3 w-3" />,
  pregnancy: <Baby className="h-3 w-3" />,
  immunosuppressed: <ShieldAlert className="h-3 w-3" />,
  bisphosphonate: <Activity className="h-3 w-3" />,
  default: <AlertTriangle className="h-3 w-3" />,
};

// Cores por severidade
const severityColors: Record<string, string> = {
  critical: 'bg-red-600 hover:bg-red-700 text-white',
  high: 'bg-red-500 hover:bg-red-600 text-white',
  medium: 'bg-orange-500 hover:bg-orange-600 text-white',
  low: 'bg-yellow-500 hover:bg-yellow-600 text-black',
};

export function PatientRiskAlerts({
  patientId,
  compact = false,
  showAddButton = true,
  onAlertsChange,
}: PatientRiskAlertsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [selectedAlertType, setSelectedAlertType] = React.useState<string>('');
  const [alertDetails, setAlertDetails] = React.useState('');
  const [alertNotes, setAlertNotes] = React.useState('');

  // Buscar alertas do paciente
  const { data: alerts = [], isLoading } = useQuery<RiskAlert[]>({
    queryKey: ['patient-risk-alerts', patientId],
    queryFn: async () => {
      const res = await fetch(`/api/risk-alerts/patient/${patientId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao buscar alertas');
      return res.json();
    },
    enabled: !!patientId,
  });

  // Buscar tipos de alerta disponíveis
  const { data: alertTypes = [] } = useQuery<RiskAlertType[]>({
    queryKey: ['risk-alert-types'],
    queryFn: async () => {
      const res = await fetch('/api/risk-alerts/types', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao buscar tipos de alerta');
      return res.json();
    },
  });

  // Adicionar alerta
  const addAlertMutation = useMutation({
    mutationFn: async (data: { alertTypeId: number; details: string; notes: string }) => {
      const res = await fetch(`/api/risk-alerts/patient/${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao adicionar alerta');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-risk-alerts', patientId] });
      setIsAddDialogOpen(false);
      setSelectedAlertType('');
      setAlertDetails('');
      setAlertNotes('');
      toast({ title: 'Alerta adicionado com sucesso' });
      onAlertsChange?.();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Remover alerta
  const removeAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      const res = await fetch(`/api/risk-alerts/${alertId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao remover alerta');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-risk-alerts', patientId] });
      toast({ title: 'Alerta removido' });
      onAlertsChange?.();
    },
  });

  // Auto-detectar alertas
  const autoDetectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/risk-alerts/auto-detect/${patientId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro na auto-detecção');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patient-risk-alerts', patientId] });
      if (data.inserted > 0) {
        toast({ title: `${data.inserted} alerta(s) detectado(s) automaticamente` });
      } else {
        toast({ title: 'Nenhum novo alerta detectado' });
      }
      onAlertsChange?.();
    },
  });

  const handleAddAlert = () => {
    if (!selectedAlertType) return;
    addAlertMutation.mutate({
      alertTypeId: parseInt(selectedAlertType),
      details: alertDetails,
      notes: alertNotes,
    });
  };

  if (isLoading) {
    return <div className="animate-pulse h-6 w-24 bg-muted rounded" />;
  }

  if (alerts.length === 0 && !showAddButton) {
    return null;
  }

  // Modo compacto (para listas)
  if (compact) {
    if (alerts.length === 0) return null;

    return (
      <TooltipProvider>
        <div className="flex flex-wrap gap-1">
          {alerts.slice(0, 3).map((alert) => (
            <Tooltip key={alert.id}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className={`${severityColors[alert.severity] || severityColors.medium} text-xs px-1.5 py-0.5`}
                >
                  {iconMap[alert.code] || iconMap.default}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="font-semibold">{alert.name}</div>
                {alert.details && <div className="text-sm">{alert.details}</div>}
                {alert.clinicalWarning && (
                  <div className="text-sm text-orange-300 mt-1">
                    {alert.clinicalWarning}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
          {alerts.length > 3 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
              +{alerts.length - 3}
            </Badge>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Modo completo
  return (
    <div className="space-y-3">
      {/* Header com botões */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          Alertas de Risco
        </h4>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => autoDetectMutation.mutate()}
            disabled={autoDetectMutation.isPending}
            title="Detectar alertas automaticamente"
          >
            <RefreshCw className={`h-4 w-4 ${autoDetectMutation.isPending ? 'animate-spin' : ''}`} />
          </Button>
          {showAddButton && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Alerta de Risco</DialogTitle>
                  <DialogDescription>
                    Adicione um alerta importante sobre a condição de saúde do paciente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tipo de Alerta</Label>
                    <Select value={selectedAlertType} onValueChange={setSelectedAlertType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {alertTypes
                          .filter(t => !alerts.some(a => a.code === t.code))
                          .map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: type.color }}
                                />
                                {type.name}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Detalhes</Label>
                    <Input
                      placeholder="Ex: Penicilina, AAS 100mg/dia..."
                      value={alertDetails}
                      onChange={(e) => setAlertDetails(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      placeholder="Observações adicionais..."
                      value={alertNotes}
                      onChange={(e) => setAlertNotes(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleAddAlert}
                    disabled={!selectedAlertType || addAlertMutation.isPending}
                    className="w-full"
                  >
                    Adicionar Alerta
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Lista de alertas */}
      {alerts.length === 0 ? (
        <div className="text-sm text-muted-foreground italic py-2">
          Nenhum alerta de risco registrado
        </div>
      ) : (
        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert) => (
              <Tooltip key={alert.id}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className={`${severityColors[alert.severity] || severityColors.medium} px-3 py-1.5 text-sm flex items-center gap-2 cursor-help`}
                  >
                    {iconMap[alert.code] || iconMap.default}
                    <span>{alert.name}</span>
                    {alert.details && (
                      <span className="font-normal opacity-90">
                        ({alert.details.length > 20 ? alert.details.substring(0, 20) + '...' : alert.details})
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAlertMutation.mutate(alert.id);
                      }}
                      className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                      title="Remover alerta"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <div className="space-y-2">
                    <div className="font-semibold text-base">{alert.name}</div>
                    {alert.details && (
                      <div>
                        <span className="font-medium">Detalhes:</span> {alert.details}
                      </div>
                    )}
                    {alert.clinicalWarning && (
                      <div className="bg-orange-500/20 text-orange-700 dark:text-orange-300 p-2 rounded text-sm flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{alert.clinicalWarning}</span>
                      </div>
                    )}
                    {alert.notes && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Obs:</span> {alert.notes}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Detectado em: {new Date(alert.detectedAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

export default PatientRiskAlerts;
