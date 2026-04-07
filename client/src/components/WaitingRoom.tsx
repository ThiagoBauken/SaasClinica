/**
 * WaitingRoom — Sala de Espera
 *
 * Sidebar panel that lists patients whose appointment status is 'arrived' for today.
 * Live wait-time counters update every 30 seconds; the data list refreshes every 15 s.
 *
 * Usage:
 *   import WaitingRoom from "@/components/WaitingRoom";
 *
 *   <WaitingRoom
 *     onOpenRecord={(patientId) => navigate(`/patients/${patientId}`)}
 *     className="w-80"
 *   />
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInMinutes, parseISO } from "date-fns";
import {
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArrivedAppointment {
  /** Appointment primary key */
  id: number;
  /** Patient primary key — used for onOpenRecord callback */
  patientId: number;
  /** Display name of the patient */
  patientName: string;
  /** ISO datetime string representing when the patient arrived (check-in timestamp) */
  arrivedAt: string;
  /** Scheduled start time in "HH:mm" format, e.g. "14:00" */
  scheduledTime: string;
  /** Name of the attending professional */
  professionalName: string;
  /**
   * Whether the patient already has a completed anamnesis on file.
   * A falsy value causes the "Sem anamnese" warning badge to appear.
   */
  hasAnamnesis?: boolean | null;
}

interface AppointmentsApiResponse {
  data: ArrivedAppointment[];
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface WaitingRoomProps {
  /** Callback fired when the user clicks on a patient row. */
  onOpenRecord?: (patientId: number) => void;
  /** Extra Tailwind classes applied to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helper — format wait-time duration
// ---------------------------------------------------------------------------

function formatWaitTime(arrivedAt: string): string {
  const minutes = differenceInMinutes(new Date(), parseISO(arrivedAt));
  if (minutes < 1) return "< 1min";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`;
}

/**
 * Returns a Tailwind text-colour class that escalates with wait time:
 *   0–14 min  → green
 *  15–29 min  → yellow/amber
 *  30+ min    → red
 */
function waitTimeColorClass(arrivedAt: string): string {
  const minutes = differenceInMinutes(new Date(), parseISO(arrivedAt));
  if (minutes >= 30) return "text-red-500";
  if (minutes >= 15) return "text-amber-500";
  return "text-emerald-600";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WaitingRoom({ onOpenRecord, className }: WaitingRoomProps) {
  const [isOpen, setIsOpen] = useState(true);

  /**
   * Tick state — incremented every 30 s to force a re-render so that the
   * live wait-time strings update without a full network refetch.
   */
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timerId = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 30_000);
    return () => clearInterval(timerId);
  }, []);

  // Today's date formatted for the query-string parameter
  const today = format(new Date(), "yyyy-MM-dd");

  const {
    data,
    isLoading,
    isError,
  } = useQuery<AppointmentsApiResponse>({
    queryKey: ["/api/v1/appointments", { status: "arrived", date: today }],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/appointments?status=arrived&date=${today}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        throw new Error(`Erro ao carregar sala de espera: ${res.status}`);
      }
      return res.json();
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  /**
   * Sort patients by arrivedAt ascending so the one waiting the longest
   * appears at the top of the list.
   */
  const patients: ArrivedAppointment[] = (data?.data ?? []).slice().sort(
    (a, b) => parseISO(a.arrivedAt).getTime() - parseISO(b.arrivedAt).getTime()
  );

  const handleRowClick = useCallback(
    (patientId: number) => {
      onOpenRecord?.(patientId);
    },
    [onOpenRecord]
  );

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderPatientRow(appointment: ArrivedAppointment) {
    // The `tick` variable is referenced here so that React re-renders rows
    // each time the interval fires, keeping the displayed durations fresh.
    void tick;

    const waitColor = waitTimeColorClass(appointment.arrivedAt);

    return (
      <button
        key={appointment.id}
        type="button"
        onClick={() => handleRowClick(appointment.patientId)}
        className={cn(
          "w-full text-left rounded-lg border border-border bg-card px-3 py-2.5",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-ring focus-visible:ring-offset-1",
          "transition-colors duration-150 space-y-1"
        )}
        aria-label={`Abrir prontuário de ${appointment.patientName}`}
      >
        {/* Top row — patient name + anamnesis warning */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground truncate">
              {appointment.patientName}
            </span>
          </div>

          {!appointment.hasAnamnesis && (
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-amber-400 bg-amber-50 text-amber-700 text-[10px] py-0 px-1.5"
              aria-label="Anamnese pendente"
            >
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
              Sem anamnese
            </Badge>
          )}
        </div>

        {/* Bottom row — scheduled time, professional, wait timer */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3 min-w-0">
            {/* Scheduled time */}
            <span
              className="flex items-center gap-0.5"
              aria-label={`Horário agendado: ${appointment.scheduledTime}`}
            >
              <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
              {appointment.scheduledTime}
            </span>

            {/* Professional */}
            <span className="truncate" aria-label={`Profissional: ${appointment.professionalName}`}>
              {appointment.professionalName}
            </span>
          </div>

          {/* Live wait time */}
          <span
            className={cn("shrink-0 font-semibold tabular-nums", waitColor)}
            aria-label={`Tempo de espera: ${formatWaitTime(appointment.arrivedAt)}`}
          >
            {formatWaitTime(appointment.arrivedAt)}
          </span>
        </div>
      </button>
    );
  }

  function renderBody() {
    if (isLoading) {
      return (
        <div
          className="flex flex-col gap-2 px-1"
          aria-label="Carregando pacientes"
          aria-busy="true"
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 w-full animate-pulse rounded-lg bg-muted"
              aria-hidden="true"
            />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <p className="px-1 text-sm text-destructive" role="alert">
          Erro ao carregar sala de espera. Tente novamente.
        </p>
      );
    }

    if (patients.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Users className="h-8 w-8 opacity-40" aria-hidden="true" />
          <p className="text-sm">Nenhum paciente na sala de espera</p>
        </div>
      );
    }

    return (
      <ScrollArea className="max-h-[420px] pr-1">
        <div
          className="flex flex-col gap-2 pb-1"
          role="list"
          aria-label={`${patients.length} paciente${patients.length !== 1 ? "s" : ""} aguardando`}
        >
          {patients.map((apt) => (
            <div key={apt.id} role="listitem">
              {renderPatientRow(apt)}
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card
      className={cn("w-full", className)}
      role="region"
      aria-label="Sala de Espera"
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-0 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                Sala de Espera
                {!isLoading && (
                  <span
                    className="ml-1 text-muted-foreground font-normal"
                    aria-label={`${patients.length} paciente${patients.length !== 1 ? "s" : ""}`}
                  >
                    ({patients.length})
                  </span>
                )}
              </span>
            </CardTitle>

            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={isOpen ? "Recolher sala de espera" : "Expandir sala de espera"}
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-3 pb-4 px-4">
            {renderBody()}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
