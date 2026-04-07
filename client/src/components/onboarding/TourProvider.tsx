/**
 * TourProvider — React context that controls the GuidedTour lifecycle.
 *
 * The tour is shown automatically when ALL of the following conditions are true:
 *   1. The onboarding wizard has been completed
 *      (localStorage key: "onboarding_complete" === "true")
 *   2. The guided tour has NOT been completed yet
 *      (localStorage key: "guided_tour_completed" is absent or !== "true")
 *   3. The tour has not already been displayed in the current session
 *      (sessionStorage key: "tour_shown" !== "true")
 *
 * The tour can also be triggered manually via `startTour()` from any
 * component inside the provider — useful for a "Ver tour novamente" button
 * in a Help page or Settings page.
 *
 * ─────────────────────────────────────────────────────────
 * INTEGRATION GUIDE
 * ─────────────────────────────────────────────────────────
 *
 * 1. Wrap your layout (or App root) with TourProvider:
 *
 *    // DashboardLayout.tsx (already imports OnboardingWizard)
 *    import { TourProvider } from "@/components/onboarding/TourProvider";
 *
 *    export default function DashboardLayout({ children, ... }) {
 *      return (
 *        <TourProvider>
 *          <TrialGuard>
 *            <div className="min-h-screen flex flex-col">
 *              <OnboardingWizard />
 *              <Header ... />
 *              <div className="flex-1 flex overflow-hidden">
 *                <Sidebar ... />
 *                <main ...>{children}</main>
 *              </div>
 *            </div>
 *          </TrialGuard>
 *        </TourProvider>
 *      );
 *    }
 *
 * 2. Add data-tour attributes in Sidebar.tsx:
 *
 *    <Link href="/agenda"      data-tour="sidebar-agenda"      …>Agenda</Link>
 *    <Link href="/patients"    data-tour="sidebar-patients"    …>Pacientes</Link>
 *    <Link href="/atendimento" data-tour="sidebar-atendimento" …>Atendimento</Link>
 *    <Link href="/financial"   data-tour="sidebar-financial"   …>Financeiro</Link>
 *
 * 3. Add data-tour attribute in Header.tsx — wrap NotificationBell:
 *
 *    <span data-tour="header-notifications">
 *      <NotificationBell />
 *    </span>
 *
 * 4. (Optional) Trigger manually from Help page:
 *
 *    import { useTour } from "@/components/onboarding/TourProvider";
 *    const { startTour } = useTour();
 *    <Button onClick={startTour}>Iniciar tour guiado</Button>
 *
 * ─────────────────────────────────────────────────────────
 * localStorage / sessionStorage keys used
 * ─────────────────────────────────────────────────────────
 *   "onboarding_complete"    — set by OnboardingWizard on completion
 *   "guided_tour_completed"  — set by TourProvider when tour finishes or is skipped
 *   "tour_shown"             — sessionStorage; prevents auto-show on every page reload
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
  type FC,
} from "react";
import { GuidedTour, TOUR_STEPS, type TourStep } from "./GuidedTour";

// ─────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: "onboarding_complete",
  TOUR_COMPLETED: "guided_tour_completed",
  TOUR_SHOWN_SESSION: "tour_shown",
} as const;

function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === "true";
  } catch {
    return false;
  }
}

function hasCompletedTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOUR_COMPLETED) === "true";
  } catch {
    return false;
  }
}

function markTourCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TOUR_COMPLETED, "true");
    sessionStorage.setItem(STORAGE_KEYS.TOUR_SHOWN_SESSION, "true");
  } catch {
    // Silently ignore storage errors (private browsing, quota exceeded, etc.)
  }
}

function hasShownTourThisSession(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.TOUR_SHOWN_SESSION) === "true";
  } catch {
    return false;
  }
}

function markTourShownInSession(): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.TOUR_SHOWN_SESSION, "true");
  } catch {
    // Silently ignore
  }
}

// ─────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────

export interface TourContextType {
  /** Start (or restart) the guided tour from step 1. */
  startTour: () => void;
  /** Whether the tour overlay is currently visible. */
  isActive: boolean;
  /** Whether the user has already completed the tour at least once. */
  hasCompleted: boolean;
  /** Reset the completion flag so the tour can run again (useful in dev/testing). */
  resetTour: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

// ─────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────

export interface TourProviderProps {
  children: ReactNode;
  /** Override the default TOUR_STEPS with custom steps. */
  steps?: TourStep[];
  /**
   * Delay in milliseconds before auto-starting the tour after the page mounts.
   * Gives the layout time to render all sidebar items before measuring rects.
   * Default: 1500 ms.
   */
  autoStartDelay?: number;
}

export const TourProvider: FC<TourProviderProps> = ({
  children,
  steps = TOUR_STEPS,
  autoStartDelay = 1500,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(hasCompletedTour);

  // ── Auto-start logic ──────────────────────────────────
  useEffect(() => {
    // Conditions: onboarding done, tour not yet completed, not shown this session
    if (!hasCompletedOnboarding()) return;
    if (hasCompletedTour()) return;
    if (hasShownTourThisSession()) return;

    markTourShownInSession();

    const timer = setTimeout(() => {
      setIsActive(true);
    }, autoStartDelay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally runs only once on mount

  // ── Manual trigger ────────────────────────────────────
  const startTour = useCallback(() => {
    setIsActive(true);
  }, []);

  // ── Completion handler ────────────────────────────────
  const handleComplete = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    markTourCompleted();
  }, []);

  // ── Skip handler (same effect as complete) ────────────
  const handleSkip = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    markTourCompleted();
  }, []);

  // ── Dev/test reset ────────────────────────────────────
  const resetTour = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOUR_COMPLETED);
      sessionStorage.removeItem(STORAGE_KEYS.TOUR_SHOWN_SESSION);
    } catch {
      // Ignore
    }
    setHasCompleted(false);
    setIsActive(false);
  }, []);

  return (
    <TourContext.Provider value={{ startTour, isActive, hasCompleted, resetTour }}>
      {children}

      {/* The GuidedTour renders into document.body via portal, so it can
          be declared anywhere in the tree without affecting layout. */}
      <GuidedTour
        isActive={isActive}
        steps={steps}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </TourContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────
// Consumer hook
// ─────────────────────────────────────────────────────────

/**
 * Hook to access tour controls from any component inside TourProvider.
 *
 * @example
 * const { startTour, isActive } = useTour();
 * <Button onClick={startTour} disabled={isActive}>Ver tour</Button>
 */
export function useTour(): TourContextType {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used inside <TourProvider>.");
  }
  return ctx;
}

export default TourProvider;
