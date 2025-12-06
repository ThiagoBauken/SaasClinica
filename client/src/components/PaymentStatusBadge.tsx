import { Badge } from "@/components/ui/badge";
import { DollarSign, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'overdue' | 'not_required';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  amount?: number;
  paidAmount?: number;
  onQuickBill?: () => void;
  compact?: boolean;
}

export default function PaymentStatusBadge({
  status,
  amount = 0,
  paidAmount = 0,
  onQuickBill,
  compact = false,
}: PaymentStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'paid':
        return {
          label: 'Pago',
          color: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
          icon: CheckCircle2,
          iconColor: 'text-green-600 dark:text-green-400',
        };
      case 'pending':
        return {
          label: 'Pendente',
          color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
          icon: Clock,
          iconColor: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'partial':
        return {
          label: 'Parcial',
          color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
          icon: DollarSign,
          iconColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'overdue':
        return {
          label: 'Atrasado',
          color: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
          icon: AlertCircle,
          iconColor: 'text-red-600 dark:text-red-400',
        };
      case 'not_required':
        return {
          label: 'Sem cobrança',
          color: 'bg-muted text-muted-foreground border-border',
          icon: DollarSign,
          iconColor: 'text-muted-foreground',
        };
      default:
        return {
          label: 'Desconhecido',
          color: 'bg-muted text-muted-foreground border-border',
          icon: DollarSign,
          iconColor: 'text-muted-foreground',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (status === 'not_required') {
    return null; // Não mostrar nada se não houver pagamento
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${config.color} flex items-center gap-1 cursor-help`}>
              <Icon className={`h-3 w-3 ${config.iconColor}`} />
              <span className="text-xs">{config.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <p className="font-semibold">Status: {config.label}</p>
              {amount > 0 && (
                <>
                  <p>Valor total: {formatCurrency(amount)}</p>
                  {status === 'partial' && (
                    <>
                      <p>Pago: {formatCurrency(paidAmount)}</p>
                      <p>Restante: {formatCurrency(amount - paidAmount)}</p>
                    </>
                  )}
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`${config.color} flex items-center gap-1.5`}>
        <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} />
        <div className="flex flex-col">
          <span className="text-xs font-medium">{config.label}</span>
          {amount > 0 && (
            <span className="text-xs font-semibold">
              {status === 'partial'
                ? `${formatCurrency(paidAmount)} / ${formatCurrency(amount)}`
                : formatCurrency(amount)}
            </span>
          )}
        </div>
      </Badge>

      {onQuickBill && status !== 'paid' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-500/10"
                onClick={onQuickBill}
              >
                <DollarSign className="h-3 w-3 mr-1" />
                Cobrar
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Gerar cobrança rápida</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
