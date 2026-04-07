import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import PaymentStatusBadge, { PaymentStatus } from "@/components/PaymentStatusBadge";
import { Users } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Appointment {
  id: number;
  date: Date;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  patientName: string;
  professionalName: string;
  professionalId: number;
  procedure: string;
  status: string;
  paymentStatus?: PaymentStatus;
  paymentAmount?: number;
  paidAmount?: number;
}

interface Professional {
  id: number;
  name: string;
  specialty?: string;
}

interface CalendarMultiProfessionalViewProps {
  appointments: Appointment[];
  professionals: Professional[];
  selectedDate: Date;
  /** Granularity in minutes for time slot rows. Defaults to 30. */
  timeInterval?: 15 | 20 | 30 | 60;
  onAppointmentClick?: (appointment: Appointment) => void;
  onSlotClick?: (date: Date, time: string, professionalId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the row-span count (number of slots) an appointment occupies. */
function slotSpan(startTime: string, endTime: string, interval: number): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(1, Math.round(durationMinutes / interval));
}

/** Converts "HH:mm" to total minutes since midnight. */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const STATUS_CLASSES: Record<string, string> = {
  confirmado: "bg-green-500/15 border-l-green-500 text-green-800 dark:text-green-300",
  confirmed:  "bg-green-500/15 border-l-green-500 text-green-800 dark:text-green-300",
  agendado:   "bg-blue-500/15 border-l-blue-500 text-blue-800 dark:text-blue-300",
  scheduled:  "bg-blue-500/15 border-l-blue-500 text-blue-800 dark:text-blue-300",
  cancelado:  "bg-red-500/15 border-l-red-500 text-red-800 dark:text-red-300",
  cancelled:  "bg-red-500/15 border-l-red-500 text-red-800 dark:text-red-300",
  arrived:    "bg-orange-500/15 border-l-orange-500 text-orange-800 dark:text-orange-300",
  completed:  "bg-emerald-500/15 border-l-emerald-500 text-emerald-800 dark:text-emerald-300",
  in_progress:"bg-purple-500/15 border-l-purple-500 text-purple-800 dark:text-purple-300",
  no_show:    "bg-gray-400/15 border-l-gray-400 text-gray-600 dark:text-gray-400",
};

function getStatusClass(status: string): string {
  return STATUS_CLASSES[status] ?? "bg-muted/40 border-l-muted-foreground text-muted-foreground";
}

// Row height in pixels for a single time-slot row (used for span calculations)
const ROW_HEIGHT_PX = 48;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CalendarMultiProfessionalView
 *
 * Renders a day-view grid with one column per professional, allowing side-by-side
 * comparison of schedules. Clicking an empty slot fires `onSlotClick`; clicking
 * an appointment fires `onAppointmentClick`.
 *
 * Usage:
 * ```tsx
 * <CalendarMultiProfessionalView
 *   appointments={filteredAppointments}
 *   professionals={professionals}
 *   selectedDate={selectedDate}
 *   timeInterval={30}
 *   onAppointmentClick={handleAppointmentClick}
 *   onSlotClick={(date, time, professionalId) => {
 *     setNewAppointment(prev => ({
 *       ...prev,
 *       date: format(date, "yyyy-MM-dd"),
 *       time,
 *       professionalId: professionalId.toString(),
 *     }));
 *     setIsNewAppointmentOpen(true);
 *   }}
 * />
 * ```
 */
export default function CalendarMultiProfessionalView({
  appointments,
  professionals,
  selectedDate,
  timeInterval = 30,
  onAppointmentClick,
  onSlotClick,
}: CalendarMultiProfessionalViewProps) {
  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  /** All "HH:mm" slots from 07:00 to 19:xx depending on interval */
  const timeSlots = useMemo<string[]>(() => {
    const slots: string[] = [];
    const intervalsPerHour = 60 / timeInterval;
    for (let hour = 7; hour < 20; hour++) {
      for (let i = 0; i < intervalsPerHour; i++) {
        const minutes = i * timeInterval;
        slots.push(
          `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
        );
      }
    }
    return slots;
  }, [timeInterval]);

  /** Appointments that fall on the selected date, keyed by professionalId */
  const appointmentsByProfessional = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    professionals.forEach((p) => map.set(p.id, []));

    appointments.forEach((appt) => {
      if (!isSameDay(appt.date, selectedDate)) return;
      const list = map.get(appt.professionalId);
      if (list) {
        list.push(appt);
      }
    });

    return map;
  }, [appointments, professionals, selectedDate]);

  /**
   * For each professional, build a Set of "HH:mm" strings that are "occupied"
   * (i.e. they fall within an appointment's [startTime, endTime) range but are
   * NOT the first slot of the appointment). This lets us skip rendering a cell
   * for continuation rows.
   */
  const occupiedSlots = useMemo(() => {
    const map = new Map<number, Set<string>>();
    professionals.forEach((p) => map.set(p.id, new Set()));

    professionals.forEach((prof) => {
      const profAppts = appointmentsByProfessional.get(prof.id) ?? [];
      const occupied = map.get(prof.id)!;

      profAppts.forEach((appt) => {
        const startMins = toMinutes(appt.startTime);
        const endMins = toMinutes(appt.endTime);
        // Mark every slot AFTER the start as occupied continuation
        let cursor = startMins + timeInterval;
        while (cursor < endMins) {
          const h = Math.floor(cursor / 60).toString().padStart(2, "0");
          const m = (cursor % 60).toString().padStart(2, "0");
          occupied.add(`${h}:${m}`);
          cursor += timeInterval;
        }
      });
    });

    return map;
  }, [appointmentsByProfessional, professionals, timeInterval]);

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  if (professionals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground border rounded-lg bg-muted/10">
        <Users className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">Nenhum profissional cadastrado</p>
        <p className="text-xs opacity-70">Adicione profissionais em Configurações para usar esta visualização.</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const colTemplate = `80px repeat(${professionals.length}, minmax(160px, 1fr))`;

  return (
    <div className="border rounded-lg overflow-auto max-h-[calc(100vh-260px)]">
      {/* ------------------------------------------------------------------ */}
      {/* Sticky header row with professional names                           */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="grid sticky top-0 z-20 bg-background border-b shadow-sm"
        style={{ gridTemplateColumns: colTemplate }}
      >
        {/* Corner cell */}
        <div className="p-2 border-r bg-muted/60 flex items-end justify-center pb-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {format(selectedDate, "EEE dd/MM", { locale: ptBR })}
          </span>
        </div>

        {professionals.map((prof) => {
          const count = (appointmentsByProfessional.get(prof.id) ?? []).length;
          return (
            <div
              key={prof.id}
              className="p-2 text-center border-r bg-muted/60 last:border-r-0"
            >
              <div className="font-semibold text-sm truncate leading-tight">
                {prof.name}
              </div>
              {prof.specialty && (
                <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                  {prof.specialty}
                </div>
              )}
              <div className="mt-1">
                <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {count} consulta{count !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Time grid                                                           */}
      {/* ------------------------------------------------------------------ */}
      {timeSlots.map((time, slotIndex) => {
        const isHourBoundary = time.endsWith(":00");

        return (
          <div
            key={time}
            className={cn(
              "grid border-b last:border-b-0",
              isHourBoundary ? "border-border" : "border-border/40"
            )}
            style={{
              gridTemplateColumns: colTemplate,
              minHeight: `${ROW_HEIGHT_PX}px`,
            }}
          >
            {/* Time label */}
            <div
              className={cn(
                "px-2 border-r flex items-start pt-1",
                isHourBoundary ? "bg-muted/30" : "bg-transparent"
              )}
            >
              {isHourBoundary && (
                <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                  {time}
                </span>
              )}
            </div>

            {/* Professional cells */}
            {professionals.map((prof) => {
              const isOccupiedContinuation = occupiedSlots.get(prof.id)?.has(time) ?? false;

              // Skip continuation cells — the appointment card from the first
              // slot already spans them visually (absolute positioning within
              // the first-slot cell).
              if (isOccupiedContinuation) {
                return (
                  <div
                    key={prof.id}
                    className="border-r last:border-r-0 bg-muted/10"
                  />
                );
              }

              const profAppts = appointmentsByProfessional.get(prof.id) ?? [];
              const appt = profAppts.find((a) => a.startTime === time);

              if (appt) {
                const span = slotSpan(appt.startTime, appt.endTime, timeInterval);
                const cardHeight = span * ROW_HEIGHT_PX - 4; // 2px top + 2px bottom padding

                return (
                  <div
                    key={prof.id}
                    className="border-r last:border-r-0 relative p-0.5"
                    style={{ height: `${span * ROW_HEIGHT_PX}px` }}
                  >
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded border-l-4 px-2 py-1 text-left",
                        "transition-all duration-150 hover:brightness-95 active:scale-[0.98]",
                        "overflow-hidden",
                        getStatusClass(appt.status)
                      )}
                      style={{ height: `${cardHeight}px` }}
                      onClick={() => onAppointmentClick?.(appt)}
                      aria-label={`Consulta de ${appt.patientName} às ${appt.startTime}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-medium leading-tight truncate flex-1">
                          {appt.patientName}
                        </span>
                        <span className="text-[10px] opacity-70 whitespace-nowrap shrink-0">
                          {appt.startTime}–{appt.endTime}
                        </span>
                      </div>
                      {cardHeight > 36 && (
                        <div className="text-[10px] opacity-75 truncate mt-0.5 leading-tight">
                          {appt.procedure}
                        </div>
                      )}
                      {cardHeight > 56 && appt.paymentStatus && appt.paymentStatus !== "not_required" && (
                        <div className="mt-1">
                          <PaymentStatusBadge
                            status={appt.paymentStatus}
                            amount={appt.paymentAmount}
                            paidAmount={appt.paidAmount}
                            compact
                          />
                        </div>
                      )}
                    </button>
                  </div>
                );
              }

              // Empty clickable slot
              return (
                <div
                  key={prof.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Horário livre às ${time} para ${prof.name}`}
                  className={cn(
                    "border-r last:border-r-0 cursor-pointer",
                    "hover:bg-primary/5 active:bg-primary/10 transition-colors duration-100",
                    isHourBoundary ? "bg-muted/5" : "bg-transparent"
                  )}
                  onClick={() => onSlotClick?.(selectedDate, time, prof.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSlotClick?.(selectedDate, time, prof.id);
                    }
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
