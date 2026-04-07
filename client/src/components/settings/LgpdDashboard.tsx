import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { getCsrfHeaders } from '@/lib/csrf';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  UserX,
  Clock,
  RefreshCw,
  ExternalLink,
  Loader2,
} from 'lucide-react';

/**
 * Usage:
 * import { LgpdDashboard } from '@/components/settings/LgpdDashboard';
 *
 * <LgpdDashboard />
 */

interface LgpdData {
  totalPatients: number;
  withConsent: number;
  expiredConsent: number;
  dueForRetentionReview: number;
  anonymizedPatients: number;
  lastAuditAt?: string;
}

interface MetricCard {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  description?: string;
}

export function LgpdDashboard() {
  const { toast } = useToast();

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<LgpdData>({
    queryKey: ['/api/v1/analytics/lgpd-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/v1/analytics/lgpd-dashboard', { credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao carregar dados LGPD');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Trigger consent renewal emails — optional action
  const renewalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/lgpd/send-consent-renewals', {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeaders(),
      });
      if (!res.ok) throw new Error('Falha ao enviar solicitacoes');
      return res.json();
    },
    onSuccess: (result: { sent?: number }) => {
      toast({
        title: 'Solicitacoes enviadas',
        description: `${result.sent ?? 0} e-mails de renovacao de consentimento enviados.`,
      });
    },
    onError: () => {
      toast({
        title: 'Erro ao enviar',
        description: 'Nao foi possivel enviar as solicitacoes. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div
        className="animate-pulse h-40 bg-muted rounded-lg flex items-center justify-center"
        aria-busy="true"
        aria-label="Carregando dados LGPD"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-4 flex items-center gap-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Nao foi possivel carregar os dados LGPD.</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const consentRate =
    data.totalPatients > 0
      ? Math.round((data.withConsent / data.totalPatients) * 100)
      : 0;

  const hasActions = data.expiredConsent > 0 || data.dueForRetentionReview > 0;

  const cards: MetricCard[] = [
    {
      title: 'Total de Pacientes',
      value: data.totalPatients,
      icon: Shield,
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50 dark:bg-blue-950/30',
      description: 'Registros ativos na base',
    },
    {
      title: 'Com Consentimento',
      value: `${data.withConsent} (${consentRate}%)`,
      icon: CheckCircle2,
      colorClass: 'text-green-600',
      bgClass: 'bg-green-50 dark:bg-green-950/30',
      description: 'LGPD Art. 7 — base legal',
    },
    {
      title: 'Consentimento Expirado',
      value: data.expiredConsent,
      icon: AlertTriangle,
      colorClass: data.expiredConsent > 0 ? 'text-yellow-600' : 'text-muted-foreground',
      bgClass: data.expiredConsent > 0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-muted/40',
      description: 'Mais de 2 anos sem renovacao',
    },
    {
      title: 'Revisao de Retencao',
      value: data.dueForRetentionReview,
      icon: Clock,
      colorClass: data.dueForRetentionReview > 0 ? 'text-orange-600' : 'text-muted-foreground',
      bgClass: data.dueForRetentionReview > 0 ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-muted/40',
      description: 'Periodo de retencao vencido',
    },
    {
      title: 'Dados Anonimizados',
      value: data.anonymizedPatients,
      icon: UserX,
      colorClass: 'text-gray-600',
      bgClass: 'bg-gray-50 dark:bg-gray-900/30',
      description: 'Erasure / anonimizacao',
    },
  ];

  return (
    <section aria-labelledby="lgpd-heading" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          id="lgpd-heading"
          className="text-lg font-semibold flex items-center gap-2"
        >
          <Shield className="h-5 w-5 text-blue-600" aria-hidden="true" />
          Painel LGPD
        </h3>
        <div className="flex items-center gap-2">
          {data.lastAuditAt && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Auditoria: {new Date(data.lastAuditAt).toLocaleDateString('pt-BR')}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Atualizar dados LGPD"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Consent progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Taxa de consentimento LGPD</span>
          <span aria-live="polite">{consentRate}%</span>
        </div>
        <Progress
          value={consentRate}
          aria-label={`${consentRate}% dos pacientes com consentimento ativo`}
          className="h-2"
        />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => (
          <Card key={card.title} className={`${card.bgClass} border-0`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <card.icon className={`h-4 w-4 ${card.colorClass} shrink-0`} aria-hidden="true" />
                <span className="text-xs font-medium text-muted-foreground leading-tight">
                  {card.title}
                </span>
              </div>
              <p
                className={`text-xl font-bold tabular-nums ${card.colorClass}`}
                aria-label={`${card.title}: ${card.value}`}
              >
                {card.value}
              </p>
              {card.description && (
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action recommendations */}
      {hasActions && (
        <Card className="border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Acoes Recomendadas
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-3">
            <ul
              className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200"
              aria-label="Lista de acoes de conformidade LGPD"
            >
              {data.expiredConsent > 0 && (
                <li className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className="text-yellow-700 border-yellow-400 shrink-0 mt-0.5"
                  >
                    {data.expiredConsent}
                  </Badge>
                  <span>
                    paciente{data.expiredConsent !== 1 ? 's' : ''} com consentimento expirado
                    (mais de 2 anos). Envie solicitacoes de renovacao.
                  </span>
                </li>
              )}
              {data.dueForRetentionReview > 0 && (
                <li className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className="text-orange-700 border-orange-400 shrink-0 mt-0.5"
                  >
                    {data.dueForRetentionReview}
                  </Badge>
                  <span>
                    paciente{data.dueForRetentionReview !== 1 ? 's' : ''} com periodo de
                    retencao vencido. Avalie a necessidade de anonimizacao dos dados.
                  </span>
                </li>
              )}
            </ul>

            <div className="flex flex-wrap gap-2 pt-1">
              {data.expiredConsent > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:text-yellow-200 dark:hover:bg-yellow-900"
                  onClick={() => renewalMutation.mutate()}
                  disabled={renewalMutation.isPending}
                >
                  {renewalMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  ) : null}
                  Enviar Renovacoes de Consentimento
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-yellow-800 dark:text-yellow-200"
                asChild
              >
                <a
                  href="https://www.gov.br/anpd/pt-br"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir site da ANPD (abre em nova aba)"
                >
                  <ExternalLink className="h-3 w-3 mr-2" aria-hidden="true" />
                  Ver diretrizes ANPD
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasActions && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Nenhuma acao pendente de conformidade LGPD.
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export default LgpdDashboard;
