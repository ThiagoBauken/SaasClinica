/**
 * GuidedTour & TourProvider — unit tests
 *
 * Run with:
 *   npx vitest run client/src/components/onboarding/GuidedTour.test.tsx
 *
 * Environment: jsdom (declared via @vitest-environment docblock below)
 */

// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// createPortal renders inline in jsdom so we can assert on tooltip content
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// Provide stable getBoundingClientRect for target elements
function mockElementRect(
  el: Element,
  rect: Partial<DOMRect> = {}
): void {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: 100,
    left: 50,
    width: 120,
    height: 40,
    bottom: 140,
    right: 170,
    x: 50,
    y: 100,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

// ─── Imports under test ───────────────────────────────────────────────────────

import { GuidedTour, TOUR_STEPS, type TourStep } from "./GuidedTour";
import { TourProvider, useTour } from "./TourProvider";

// ─── Minimal steps for unit tests ────────────────────────────────────────────

const MOCK_STEPS: TourStep[] = [
  {
    target: '[data-tour="step-one"]',
    title: "Passo Um",
    content: "Conteúdo do primeiro passo.",
    position: "right",
  },
  {
    target: '[data-tour="step-two"]',
    title: "Passo Dois",
    content: "Conteúdo do segundo passo.",
    position: "bottom",
  },
  {
    target: '[data-tour="step-three"]',
    title: "Passo Três",
    content: "Conteúdo do terceiro passo.",
    position: "left",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Renders GuidedTour with mock steps and target elements in the DOM.
 * Returns the mock callbacks so tests can assert on them.
 */
function renderTour(
  props: Partial<React.ComponentProps<typeof GuidedTour>> = {}
) {
  const onComplete = vi.fn();
  const onSkip = vi.fn();

  const { container } = render(
    <>
      {/* Target elements that steps reference */}
      <div data-tour="step-one">Elemento Um</div>
      <div data-tour="step-two">Elemento Dois</div>
      <div data-tour="step-three">Elemento Três</div>

      <GuidedTour
        isActive={true}
        steps={MOCK_STEPS}
        onComplete={onComplete}
        onSkip={onSkip}
        {...props}
      />
    </>
  );

  // Attach stable rects to the target elements
  container.querySelectorAll("[data-tour]").forEach((el) => mockElementRect(el));

  return { onComplete, onSkip, container };
}

// ─────────────────────────────────────────────────────────────────────────────
// GuidedTour component tests
// ─────────────────────────────────────────────────────────────────────────────

describe("GuidedTour", () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  it("renders nothing when isActive is false", () => {
    render(
      <GuidedTour
        isActive={false}
        steps={MOCK_STEPS}
        onComplete={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the tooltip dialog when isActive is true", () => {
    renderTour();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  // ── Step content ────────────────────────────────────────────────────────────

  it("shows the title and content of the first step on mount", () => {
    renderTour();
    expect(screen.getByText("Passo Um")).toBeTruthy();
    expect(screen.getByText("Conteúdo do primeiro passo.")).toBeTruthy();
  });

  it("shows the step counter as '1/3' on the first step", () => {
    renderTour();
    expect(screen.getByText("1/3")).toBeTruthy();
  });

  // ── Navigation — Next ────────────────────────────────────────────────────────

  it("advances to the next step when 'Próximo' is clicked", async () => {
    const user = userEvent.setup();
    renderTour();

    await user.click(screen.getByRole("button", { name: /próximo passo/i }));

    await waitFor(() => {
      expect(screen.getByText("Passo Dois")).toBeTruthy();
    });
  });

  it("updates the step counter after navigating forward", async () => {
    const user = userEvent.setup();
    renderTour();

    await user.click(screen.getByRole("button", { name: /próximo passo/i }));

    await waitFor(() => {
      expect(screen.getByText("2/3")).toBeTruthy();
    });
  });

  // ── Navigation — Back ────────────────────────────────────────────────────────

  it("does NOT render an 'Anterior' button on the first step", () => {
    renderTour();
    expect(screen.queryByRole("button", { name: /passo anterior/i })).toBeNull();
  });

  it("renders an 'Anterior' button from the second step onward", async () => {
    const user = userEvent.setup();
    renderTour();

    await user.click(screen.getByRole("button", { name: /próximo passo/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /passo anterior/i })).toBeTruthy();
    });
  });

  it("goes back to the previous step when 'Anterior' is clicked", async () => {
    const user = userEvent.setup();
    renderTour();

    // Go forward then backward
    await user.click(screen.getByRole("button", { name: /próximo passo/i }));
    await waitFor(() => expect(screen.getByText("Passo Dois")).toBeTruthy());

    await user.click(screen.getByRole("button", { name: /passo anterior/i }));
    await waitFor(() => expect(screen.getByText("Passo Um")).toBeTruthy());
  });

  // ── Last step — Concluir ─────────────────────────────────────────────────────

  it("renders 'Concluir' button on the last step instead of 'Próximo'", async () => {
    const user = userEvent.setup();
    renderTour();

    // Navigate to last step
    for (let i = 0; i < MOCK_STEPS.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: /próximo passo/i }));
      await waitFor(() => expect(screen.getByText(`${i + 2}/3`)).toBeTruthy());
    }

    expect(screen.getByRole("button", { name: /concluir tour/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /próximo passo/i })).toBeNull();
  });

  it("calls onComplete when 'Concluir' is clicked on the last step", async () => {
    const user = userEvent.setup();
    const { onComplete } = renderTour();

    // Navigate to last step
    for (let i = 0; i < MOCK_STEPS.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: /próximo passo/i }));
    }

    await user.click(screen.getByRole("button", { name: /concluir tour/i }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  // ── Skip ────────────────────────────────────────────────────────────────────

  it("calls onSkip when 'Pular tour' button is clicked", async () => {
    const user = userEvent.setup();
    const { onSkip } = renderTour();

    await user.click(screen.getByRole("button", { name: /pular tour/i }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("calls onSkip when the close (X) button is clicked", async () => {
    const user = userEvent.setup();
    const { onSkip } = renderTour();

    await user.click(screen.getByRole("button", { name: /fechar tour/i }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  it("advances to next step when ArrowRight key is pressed", async () => {
    renderTour();

    fireEvent.keyDown(window, { key: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByText("Passo Dois")).toBeTruthy();
    });
  });

  it("calls onSkip when Escape key is pressed", () => {
    const { onSkip } = renderTour();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("calls onComplete when Enter is pressed on the last step", async () => {
    const user = userEvent.setup();
    const { onComplete } = renderTour();

    // Navigate to last step via ArrowRight presses
    for (let i = 0; i < MOCK_STEPS.length - 1; i++) {
      await user.click(screen.getByRole("button", { name: /próximo passo/i }));
    }

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("goes back when ArrowLeft key is pressed (not on first step)", async () => {
    const user = userEvent.setup();
    renderTour();

    await user.click(screen.getByRole("button", { name: /próximo passo/i }));
    await waitFor(() => expect(screen.getByText("Passo Dois")).toBeTruthy());

    fireEvent.keyDown(window, { key: "ArrowLeft" });

    await waitFor(() => {
      expect(screen.getByText("Passo Um")).toBeTruthy();
    });
  });

  // ── Progress dots ────────────────────────────────────────────────────────────

  it("renders progress dots matching the number of steps", () => {
    renderTour();
    // Each dot has role="tab"
    const dots = screen.getAllByRole("tab");
    expect(dots).toHaveLength(MOCK_STEPS.length);
  });

  it("marks the first progress dot as selected", () => {
    renderTour();
    const dots = screen.getAllByRole("tab");
    expect(dots[0].getAttribute("aria-selected")).toBe("true");
    expect(dots[1].getAttribute("aria-selected")).toBe("false");
  });

  // ── Accessibility ────────────────────────────────────────────────────────────

  it("has an aria-modal attribute on the dialog", () => {
    renderTour();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("has an aria-label on the dialog that includes step number and title", () => {
    renderTour();
    const dialog = screen.getByRole("dialog");
    const label = dialog.getAttribute("aria-label") ?? "";
    expect(label).toContain("1 de 3");
    expect(label).toContain("Passo Um");
  });

  // ── TOUR_STEPS export ────────────────────────────────────────────────────────

  it("TOUR_STEPS contains exactly 5 predefined steps", () => {
    expect(TOUR_STEPS).toHaveLength(5);
  });

  it("all TOUR_STEPS have required fields (target, title, content, position)", () => {
    for (const step of TOUR_STEPS) {
      expect(step.target).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.content).toBeTruthy();
      expect(["top", "bottom", "left", "right"]).toContain(step.position);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TourProvider tests
// ─────────────────────────────────────────────────────────────────────────────

describe("TourProvider", () => {
  // Mock localStorage and sessionStorage
  let localStore: Record<string, string> = {};
  let sessionStore: Record<string, string> = {};

  beforeEach(() => {
    localStore = {};
    sessionStore = {};

    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
      if (typeof (window as any).__storageType === "string") {
        // handled per-object below
      }
      return null;
    });

    // Patch localStorage
    vi.spyOn(window.localStorage, "getItem").mockImplementation(
      (key) => localStore[key] ?? null
    );
    vi.spyOn(window.localStorage, "setItem").mockImplementation(
      (key, value) => { localStore[key] = value; }
    );
    vi.spyOn(window.localStorage, "removeItem").mockImplementation(
      (key) => { delete localStore[key]; }
    );

    // Patch sessionStorage
    vi.spyOn(window.sessionStorage, "getItem").mockImplementation(
      (key) => sessionStore[key] ?? null
    );
    vi.spyOn(window.sessionStorage, "setItem").mockImplementation(
      (key, value) => { sessionStore[key] = value; }
    );
    vi.spyOn(window.sessionStorage, "removeItem").mockImplementation(
      (key) => { delete sessionStore[key]; }
    );

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── Auto-start ───────────────────────────────────────────────────────────────

  it("does NOT auto-start the tour when onboarding is not complete", async () => {
    // onboarding_complete is NOT set
    render(
      <TourProvider steps={MOCK_STEPS} autoStartDelay={100}>
        <div>content</div>
      </TourProvider>
    );

    act(() => { vi.advanceTimersByTime(500); });

    // No dialog should appear
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does NOT auto-start the tour when it was already completed", async () => {
    localStore["onboarding_complete"] = "true";
    localStore["guided_tour_completed"] = "true";

    render(
      <TourProvider steps={MOCK_STEPS} autoStartDelay={100}>
        <div>content</div>
      </TourProvider>
    );

    act(() => { vi.advanceTimersByTime(500); });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does NOT auto-start if the tour was already shown this session", () => {
    localStore["onboarding_complete"] = "true";
    sessionStore["tour_shown"] = "true";

    render(
      <TourProvider steps={MOCK_STEPS} autoStartDelay={100}>
        <div>content</div>
      </TourProvider>
    );

    act(() => { vi.advanceTimersByTime(500); });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("auto-starts the tour after the delay when conditions are met", async () => {
    localStore["onboarding_complete"] = "true";
    // guided_tour_completed is NOT set
    // tour_shown is NOT set

    render(
      <TourProvider steps={MOCK_STEPS} autoStartDelay={200}>
        <div data-tour="step-one">target</div>
        <div data-tour="step-two">target2</div>
        <div data-tour="step-three">target3</div>
      </TourProvider>
    );

    // Before delay fires — no dialog
    expect(screen.queryByRole("dialog")).toBeNull();

    // Advance past the delay
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeNull();
    });
  });

  // ── startTour ────────────────────────────────────────────────────────────────

  it("exposes startTour via useTour to manually trigger the tour", async () => {
    function Trigger() {
      const { startTour } = useTour();
      return <button onClick={startTour}>Iniciar tour</button>;
    }

    render(
      <TourProvider steps={MOCK_STEPS}>
        <div data-tour="step-one">target1</div>
        <div data-tour="step-two">target2</div>
        <div data-tour="step-three">target3</div>
        <Trigger />
      </TourProvider>
    );

    await userEvent.click(screen.getByText("Iniciar tour"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeNull();
    });
  });

  // ── Completion flow ──────────────────────────────────────────────────────────

  it("marks tour as completed in localStorage when Concluir is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    function Trigger() {
      const { startTour } = useTour();
      return <button onClick={startTour}>Start</button>;
    }

    render(
      <TourProvider steps={MOCK_STEPS}>
        <div data-tour="step-one">t1</div>
        <div data-tour="step-two">t2</div>
        <div data-tour="step-three">t3</div>
        <Trigger />
      </TourProvider>
    );

    await user.click(screen.getByText("Start"));

    // Navigate to last step and click Concluir
    for (let i = 0; i < MOCK_STEPS.length - 1; i++) {
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /próximo passo/i })).toBeTruthy()
      );
      await user.click(screen.getByRole("button", { name: /próximo passo/i }));
    }

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /concluir tour/i })).toBeTruthy()
    );
    await user.click(screen.getByRole("button", { name: /concluir tour/i }));

    await waitFor(() => {
      expect(localStore["guided_tour_completed"]).toBe("true");
    });
  });

  it("hides the tour dialog after skipping", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    function Trigger() {
      const { startTour } = useTour();
      return <button onClick={startTour}>Start</button>;
    }

    render(
      <TourProvider steps={MOCK_STEPS}>
        <div data-tour="step-one">t1</div>
        <div data-tour="step-two">t2</div>
        <div data-tour="step-three">t3</div>
        <Trigger />
      </TourProvider>
    );

    await user.click(screen.getByText("Start"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());

    await user.click(screen.getByRole("button", { name: /pular tour/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // ── resetTour ────────────────────────────────────────────────────────────────

  it("resetTour clears localStorage flags so the tour can run again", () => {
    localStore["guided_tour_completed"] = "true";
    sessionStore["tour_shown"] = "true";

    function Resetter() {
      const { resetTour, hasCompleted } = useTour();
      return (
        <div>
          <button onClick={resetTour}>Reset</button>
          <span data-testid="has-completed">{String(hasCompleted)}</span>
        </div>
      );
    }

    render(
      <TourProvider steps={MOCK_STEPS}>
        <Resetter />
      </TourProvider>
    );

    expect(screen.getByTestId("has-completed").textContent).toBe("true");

    fireEvent.click(screen.getByText("Reset"));

    expect(screen.getByTestId("has-completed").textContent).toBe("false");
    expect(localStore["guided_tour_completed"]).toBeUndefined();
  });

  // ── useTour outside provider ─────────────────────────────────────────────────

  it("useTour throws when used outside TourProvider", () => {
    // Suppress expected console error in test output
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function BadConsumer() {
      useTour(); // should throw
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      "useTour must be used inside <TourProvider>."
    );

    consoleError.mockRestore();
  });

  // ── isActive state ───────────────────────────────────────────────────────────

  it("exposes isActive as false before tour is started", () => {
    function Checker() {
      const { isActive } = useTour();
      return <span data-testid="active">{String(isActive)}</span>;
    }

    render(
      <TourProvider steps={MOCK_STEPS}>
        <Checker />
      </TourProvider>
    );

    expect(screen.getByTestId("active").textContent).toBe("false");
  });

  it("exposes isActive as true after startTour is called", async () => {
    function Consumer() {
      const { startTour, isActive } = useTour();
      return (
        <div>
          <button onClick={startTour}>Start</button>
          <span data-testid="active">{String(isActive)}</span>
        </div>
      );
    }

    render(
      <TourProvider steps={MOCK_STEPS}>
        <div data-tour="step-one">t1</div>
        <div data-tour="step-two">t2</div>
        <div data-tour="step-three">t3</div>
        <Consumer />
      </TourProvider>
    );

    await userEvent.click(screen.getByText("Start"));

    await waitFor(() => {
      expect(screen.getByTestId("active").textContent).toBe("true");
    });
  });
});
