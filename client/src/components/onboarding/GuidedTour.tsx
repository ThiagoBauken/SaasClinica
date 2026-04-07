/**
 * GuidedTour — Lightweight spotlight tour using portals and getBoundingClientRect.
 *
 * No external tour libraries required. Relies only on:
 *   - React portals (createPortal)
 *   - shadcn/ui Button, Card primitives
 *   - Tailwind CSS utility classes
 *   - lucide-react icons already present in the project
 *
 * ─────────────────────────────────────────────────────────
 * data-tour ATTRIBUTE GUIDE
 * ─────────────────────────────────────────────────────────
 * Add the following attributes to the matching elements:
 *
 *   Sidebar.tsx — Agenda link:
 *     <Link href="/agenda" data-tour="sidebar-agenda" …>
 *
 *   Sidebar.tsx — Pacientes link:
 *     <Link href="/patients" data-tour="sidebar-patients" …>
 *
 *   Sidebar.tsx — Atendimento link:
 *     <Link href="/atendimento" data-tour="sidebar-atendimento" …>
 *
 *   Sidebar.tsx — Financeiro link:
 *     <Link href="/financial" data-tour="sidebar-financial" …>
 *
 *   Header.tsx — NotificationBell wrapper:
 *     <span data-tour="header-notifications">
 *       <NotificationBell />
 *     </span>
 *
 * ─────────────────────────────────────────────────────────
 * USAGE EXAMPLE
 * ─────────────────────────────────────────────────────────
 *
 *   // In your layout or any component after onboarding is done:
 *   import { GuidedTour } from "@/components/onboarding/GuidedTour";
 *
 *   // Via TourProvider context (preferred):
 *   import { useTour } from "@/components/onboarding/TourProvider";
 *   const { startTour } = useTour();
 *   <Button onClick={startTour}>Ver tour</Button>
 *
 *   // Direct rendering:
 *   <GuidedTour
 *     isActive={true}
 *     onComplete={() => console.log("tour done")}
 *     onSkip={() => console.log("tour skipped")}
 *   />
 * ─────────────────────────────────────────────────────────
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FC,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  X,
  CheckCircle2,
  MapPin,
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// Tour step definitions
// ─────────────────────────────────────────────────────────

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TourStep {
  /** CSS selector matching a DOM element with the data-tour attribute. */
  target: string;
  title: string;
  content: string;
  position: TooltipPosition;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar-agenda"]',
    title: "Agenda",
    content:
      "Gerencie todos os agendamentos da clínica. Clique em um horário vazio para agendar rapidamente.",
    position: "right",
  },
  {
    target: '[data-tour="sidebar-patients"]',
    title: "Pacientes",
    content:
      "Cadastre e gerencie seus pacientes. Busque por nome, CPF ou telefone.",
    position: "right",
  },
  {
    target: '[data-tour="sidebar-atendimento"]',
    title: "Atendimento WhatsApp",
    content:
      "Veja e responda mensagens de pacientes pelo WhatsApp em tempo real.",
    position: "right",
  },
  {
    target: '[data-tour="sidebar-financial"]',
    title: "Financeiro",
    content:
      "Controle pagamentos, orçamentos, contas a receber e caixa.",
    position: "right",
  },
  {
    target: '[data-tour="header-notifications"]',
    title: "Notificações",
    content:
      "Receba alertas de confirmações, lembretes e atualizações importantes.",
    position: "bottom",
  },
];

// ─────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────

const PADDING = 8; // extra space around the spotlight cutout (px)
const TOOLTIP_GAP = 16; // gap between target edge and tooltip (px)
const TOOLTIP_WIDTH = 320; // fixed width of the tooltip card (px)

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

function getTargetRect(selector: string): TargetRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    bottom: r.bottom,
    right: r.right,
  };
}

function computeTooltipStyle(
  rect: TargetRect,
  position: TooltipPosition,
  viewportWidth: number,
  viewportHeight: number
): CSSProperties {
  const style: CSSProperties = {
    position: "fixed",
    width: TOOLTIP_WIDTH,
    zIndex: 9999,
  };

  switch (position) {
    case "right": {
      let top = rect.top + rect.height / 2 - 80;
      // Clamp vertically so tooltip never overflows viewport
      top = Math.max(12, Math.min(top, viewportHeight - 220));
      style.top = top;
      style.left = rect.right + TOOLTIP_GAP;
      // If tooltip overflows right side, flip to left
      if (rect.right + TOOLTIP_GAP + TOOLTIP_WIDTH > viewportWidth) {
        style.left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
      }
      break;
    }
    case "left": {
      let top = rect.top + rect.height / 2 - 80;
      top = Math.max(12, Math.min(top, viewportHeight - 220));
      style.top = top;
      style.left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
      if ((style.left as number) < 12) {
        style.left = rect.right + TOOLTIP_GAP;
      }
      break;
    }
    case "bottom": {
      style.top = rect.bottom + TOOLTIP_GAP;
      let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      left = Math.max(12, Math.min(left, viewportWidth - TOOLTIP_WIDTH - 12));
      style.left = left;
      // If tooltip overflows bottom, flip to top
      if (rect.bottom + TOOLTIP_GAP + 200 > viewportHeight) {
        style.top = rect.top - 200 - TOOLTIP_GAP;
      }
      break;
    }
    case "top":
    default: {
      style.top = rect.top - 200 - TOOLTIP_GAP;
      if ((style.top as number) < 12) {
        style.top = rect.bottom + TOOLTIP_GAP;
      }
      let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      left = Math.max(12, Math.min(left, viewportWidth - TOOLTIP_WIDTH - 12));
      style.left = left;
      break;
    }
  }

  return style;
}

/**
 * Returns which side the arrow indicator should point from,
 * i.e. the opposite of the preferred position so it visually
 * points TOWARD the target element.
 */
function arrowDirection(position: TooltipPosition): "top" | "bottom" | "left" | "right" {
  const map: Record<TooltipPosition, "top" | "bottom" | "left" | "right"> = {
    right: "left",
    left: "right",
    bottom: "top",
    top: "bottom",
  };
  return map[position];
}

// ─────────────────────────────────────────────────────────
// SVG Overlay with spotlight cutout
// ─────────────────────────────────────────────────────────

interface SpotlightOverlayProps {
  rect: TargetRect | null;
  onSkip: () => void;
}

function SpotlightOverlay({ rect, onSkip }: SpotlightOverlayProps) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    // Full dark overlay when target is not found
    return (
      <svg
        style={{ position: "fixed", inset: 0, zIndex: 9990, pointerEvents: "all" }}
        width={vw}
        height={vh}
        onClick={onSkip}
        role="presentation"
        aria-hidden="true"
      >
        <rect width={vw} height={vh} fill="rgba(0,0,0,0.6)" />
      </svg>
    );
  }

  const cutoutX = rect.left - PADDING;
  const cutoutY = rect.top - PADDING;
  const cutoutW = rect.width + PADDING * 2;
  const cutoutH = rect.height + PADDING * 2;
  const r = 8; // border-radius of the spotlight cutout

  // SVG path: full viewport rect minus rounded-rectangle cutout
  // Uses evenodd fill rule so the inner path cuts a hole.
  const outerPath = `M 0 0 H ${vw} V ${vh} H 0 Z`;
  const innerPath = `
    M ${cutoutX + r} ${cutoutY}
    H ${cutoutX + cutoutW - r}
    Q ${cutoutX + cutoutW} ${cutoutY} ${cutoutX + cutoutW} ${cutoutY + r}
    V ${cutoutY + cutoutH - r}
    Q ${cutoutX + cutoutW} ${cutoutY + cutoutH} ${cutoutX + cutoutW - r} ${cutoutY + cutoutH}
    H ${cutoutX + r}
    Q ${cutoutX} ${cutoutY + cutoutH} ${cutoutX} ${cutoutY + cutoutH - r}
    V ${cutoutY + r}
    Q ${cutoutX} ${cutoutY} ${cutoutX + r} ${cutoutY}
    Z
  `;

  return (
    <svg
      style={{ position: "fixed", inset: 0, zIndex: 9990, pointerEvents: "all", cursor: "default" }}
      width={vw}
      height={vh}
      onClick={(e) => {
        // Only skip if clicking the dark overlay, not the spotlight
        const target = e.target as SVGElement;
        if (target.tagName === "path") onSkip();
      }}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        {/* Subtle glow ring around the spotlight */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.29  0 0 0 0 0.56  0 0 0 0 1  0 0 0 0.5 0"
            result="colorBlur"
          />
          <feMerge>
            <feMergeNode in="colorBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Dark overlay with hole */}
      <path
        d={`${outerPath} ${innerPath}`}
        fill="rgba(0,0,0,0.55)"
        fillRule="evenodd"
      />
      {/* Glowing border around cutout */}
      <rect
        x={cutoutX - 1}
        y={cutoutY - 1}
        width={cutoutW + 2}
        height={cutoutH + 2}
        rx={r + 1}
        fill="none"
        stroke="rgba(99,138,255,0.7)"
        strokeWidth={2}
        filter="url(#glow)"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// Arrow indicator
// ─────────────────────────────────────────────────────────

interface TooltipArrowProps {
  direction: "top" | "bottom" | "left" | "right";
}

function TooltipArrow({ direction }: TooltipArrowProps) {
  const base = "absolute w-3 h-3 bg-card border-border";
  const positions: Record<string, string> = {
    left: "-left-1.5 top-1/2 -translate-y-1/2 border-l border-b rotate-45",
    right: "-right-1.5 top-1/2 -translate-y-1/2 border-r border-t rotate-45",
    top: "-top-1.5 left-1/2 -translate-x-1/2 border-l border-t rotate-45",
    bottom: "-bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b rotate-45",
  };
  return <div className={cn(base, positions[direction])} aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────
// Progress dots
// ─────────────────────────────────────────────────────────

interface ProgressDotsProps {
  total: number;
  current: number;
}

function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label="Passos do tour">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          role="tab"
          aria-selected={i === current}
          aria-label={`Passo ${i + 1} de ${total}`}
          className={cn(
            "rounded-full transition-all duration-300",
            i === current
              ? "w-5 h-2 bg-primary"
              : "w-2 h-2 bg-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main GuidedTour component
// ─────────────────────────────────────────────────────────

export interface GuidedTourProps {
  /** Whether the tour overlay is mounted and active. */
  isActive: boolean;
  /** Called when the user clicks "Concluir" on the last step. */
  onComplete: () => void;
  /** Called when the user clicks "Pular tour". */
  onSkip: () => void;
  /** Optional custom steps. Falls back to TOUR_STEPS. */
  steps?: TourStep[];
}

export const GuidedTour: FC<GuidedTourProps> = ({
  isActive,
  onComplete,
  onSkip,
  steps = TOUR_STEPS,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const animFrameRef = useRef<number | null>(null);

  const currentStep = steps[currentIndex];
  const isLastStep = currentIndex === steps.length - 1;

  // ── Measure target element ────────────────────────────
  const measureTarget = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    // Defer measurement until after scrollIntoView settles
    animFrameRef.current = requestAnimationFrame(() => {
      animFrameRef.current = requestAnimationFrame(() => {
        setTargetRect(getTargetRect(currentStep.target));
        setVp({ w: window.innerWidth, h: window.innerHeight });
      });
    });
  }, [currentStep]);

  useEffect(() => {
    if (!isActive) return;
    measureTarget();
  }, [isActive, currentIndex, measureTarget]);

  // ── Recalculate on window resize ──────────────────────
  useEffect(() => {
    if (!isActive) return;
    const onResize = () => measureTarget();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isActive, measureTarget]);

  // ── Cleanup animation frames ──────────────────────────
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // ── Keyboard navigation ───────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (isLastStep) onComplete();
        else setCurrentIndex((i) => i + 1);
      }
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, isLastStep, currentIndex, onComplete, onSkip]);

  // ── Reset to step 0 whenever tour activates ───────────
  useEffect(() => {
    if (isActive) setCurrentIndex(0);
  }, [isActive]);

  if (!isActive || !currentStep) return null;

  const tooltipStyle = targetRect
    ? computeTooltipStyle(targetRect, currentStep.position, vp.w, vp.h)
    : { position: "fixed" as const, top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: TOOLTIP_WIDTH, zIndex: 9999 };

  const arrow = arrowDirection(currentStep.position);

  return createPortal(
    <>
      {/* ── Spotlight overlay ── */}
      <SpotlightOverlay rect={targetRect} onSkip={onSkip} />

      {/* ── Tooltip card ── */}
      <div
        style={tooltipStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour — passo ${currentIndex + 1} de ${steps.length}: ${currentStep.title}`}
        className={cn(
          // Animate in
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
      >
        {/* Gradient border wrapper */}
        <div className="p-[2px] rounded-xl bg-gradient-to-br from-primary/80 via-primary/40 to-purple-500/60 shadow-2xl relative">
          {/* Arrow */}
          <TooltipArrow direction={arrow} />

          <Card className="rounded-[10px] border-0 bg-card w-full">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base font-semibold leading-snug text-foreground">
                    {currentStep.title}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground -mt-0.5 -mr-1"
                  onClick={onSkip}
                  aria-label="Fechar tour"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="px-4 pb-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentStep.content}
              </p>
            </CardContent>

            <CardFooter className="px-4 pb-4 flex flex-col gap-3">
              {/* Progress dots */}
              <div className="flex items-center justify-between w-full">
                <ProgressDots total={steps.length} current={currentIndex} />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {currentIndex + 1}/{steps.length}
                </span>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between w-full gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground px-2 h-8 text-xs"
                  onClick={onSkip}
                >
                  Pular tour
                </Button>

                <div className="flex items-center gap-2">
                  {currentIndex > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setCurrentIndex((i) => i - 1)}
                      aria-label="Passo anterior"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Anterior
                    </Button>
                  )}

                  {isLastStep ? (
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                      onClick={onComplete}
                      aria-label="Concluir tour"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Concluir
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setCurrentIndex((i) => i + 1)}
                      aria-label="Próximo passo"
                    >
                      Próximo
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>,
    document.body
  );
};

export default GuidedTour;
