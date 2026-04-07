/**
 * WaitingRoom — unit tests
 *
 * Run with:
 *   npx vitest run client/src/components/WaitingRoom.test.tsx
 *
 * Environment: jsdom (declared via @vitest-environment docblock below)
 */

// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { subMinutes } from "date-fns";

import WaitingRoom from "./WaitingRoom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,        // fail fast in tests
        gcTime: 0,
      },
    },
  });
}

function renderWithQuery(ui: React.ReactElement) {
  const client = buildQueryClient();
  return {
    ...render(
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    ),
    client,
  };
}

/** Builds a mock ArrivedAppointment. arrivedMinutesAgo defaults to 10. */
function makeAppointment(
  overrides: Partial<{
    id: number;
    patientId: number;
    patientName: string;
    arrivedAt: string;
    scheduledTime: string;
    professionalName: string;
    hasAnamnesis: boolean | null;
  }> = {}
) {
  const arrivedAt = subMinutes(new Date(), overrides.arrivedAt ? 0 : 10).toISOString();
  return {
    id: 1,
    patientId: 101,
    patientName: "João Silva",
    arrivedAt,
    scheduledTime: "14:00",
    professionalName: "Dr. Ana",
    hasAnamnesis: true,
    ...overrides,
    // Allow caller to supply literal arrivedAt string
    ...(overrides.arrivedAt ? { arrivedAt: overrides.arrivedAt } : {}),
  };
}

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess(patients: ReturnType<typeof makeAppointment>[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: patients }),
  } as Response);
}

function mockFetchError() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({}),
  } as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WaitingRoom", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it("shows skeleton placeholders while loading", async () => {
    // Never resolves during this test
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    renderWithQuery(<WaitingRoom />);

    // Three skeleton divs should be present (animate-pulse)
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it("shows empty state message when no patients are waiting", async () => {
    mockFetchSuccess([]);

    renderWithQuery(<WaitingRoom />);

    await screen.findByText("Nenhum paciente na sala de espera");
  });

  // -------------------------------------------------------------------------
  // Header count
  // -------------------------------------------------------------------------

  it("displays patient count in the header", async () => {
    mockFetchSuccess([
      makeAppointment({ id: 1 }),
      makeAppointment({ id: 2, patientName: "Maria Santos", patientId: 102 }),
    ]);

    renderWithQuery(<WaitingRoom />);

    // Count "(2)" should appear in the header
    await screen.findByText(/\(2\)/);
  });

  // -------------------------------------------------------------------------
  // Patient row content
  // -------------------------------------------------------------------------

  it("renders patient name, scheduled time, and professional name", async () => {
    mockFetchSuccess([
      makeAppointment({
        patientName: "Carlos Oliveira",
        scheduledTime: "09:30",
        professionalName: "Dr. Bruno",
        hasAnamnesis: true,
      }),
    ]);

    renderWithQuery(<WaitingRoom />);

    await screen.findByText("Carlos Oliveira");
    expect(screen.getByText("09:30")).toBeDefined();
    expect(screen.getByText("Dr. Bruno")).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Anamnesis badge
  // -------------------------------------------------------------------------

  it("shows 'Sem anamnese' badge when hasAnamnesis is falsy", async () => {
    mockFetchSuccess([makeAppointment({ hasAnamnesis: false })]);

    renderWithQuery(<WaitingRoom />);

    await screen.findByText("Sem anamnese");
  });

  it("does NOT show 'Sem anamnese' badge when hasAnamnesis is true", async () => {
    mockFetchSuccess([makeAppointment({ hasAnamnesis: true })]);

    renderWithQuery(<WaitingRoom />);

    await screen.findByText("João Silva"); // wait for data
    expect(screen.queryByText("Sem anamnese")).toBeNull();
  });

  it("shows 'Sem anamnese' badge when hasAnamnesis is null", async () => {
    mockFetchSuccess([makeAppointment({ hasAnamnesis: null })]);

    renderWithQuery(<WaitingRoom />);

    await screen.findByText("Sem anamnese");
  });

  // -------------------------------------------------------------------------
  // Sort order — longest wait first
  // -------------------------------------------------------------------------

  it("sorts patients so the longest-waiting appears first", async () => {
    const recent = makeAppointment({
      id: 1,
      patientName: "Paciente Recente",
      patientId: 1,
      arrivedAt: subMinutes(new Date(), 5).toISOString(),
    });
    const older = makeAppointment({
      id: 2,
      patientName: "Paciente Antigo",
      patientId: 2,
      arrivedAt: subMinutes(new Date(), 30).toISOString(),
    });

    // API returns them in reverse order to verify sorting
    mockFetchSuccess([recent, older]);

    renderWithQuery(<WaitingRoom />);

    const names = await screen.findAllByText(/Paciente/);
    // "Paciente Antigo" must appear before "Paciente Recente"
    expect(names[0].textContent).toBe("Paciente Antigo");
    expect(names[1].textContent).toBe("Paciente Recente");
  });

  // -------------------------------------------------------------------------
  // onOpenRecord callback
  // -------------------------------------------------------------------------

  it("calls onOpenRecord with the correct patientId when a row is clicked", async () => {
    const onOpenRecord = vi.fn();
    mockFetchSuccess([makeAppointment({ patientId: 999 })]);

    renderWithQuery(<WaitingRoom onOpenRecord={onOpenRecord} />);

    const button = await screen.findByRole("button", {
      name: /Abrir prontuário de João Silva/i,
    });

    await userEvent.click(button);

    expect(onOpenRecord).toHaveBeenCalledOnce();
    expect(onOpenRecord).toHaveBeenCalledWith(999);
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it("shows error message when the API request fails", async () => {
    mockFetchError();

    renderWithQuery(<WaitingRoom />);

    await screen.findByText(/Erro ao carregar sala de espera/i);
  });

  // -------------------------------------------------------------------------
  // Collapsible
  // -------------------------------------------------------------------------

  it("collapses and expands the patient list on toggle", async () => {
    mockFetchSuccess([makeAppointment()]);

    renderWithQuery(<WaitingRoom />);

    // Panel is expanded by default — patient name is visible
    await screen.findByText("João Silva");

    // Click the collapse button
    const collapseBtn = screen.getByRole("button", {
      name: /Recolher sala de espera/i,
    });
    await userEvent.click(collapseBtn);

    // After collapse the aria-label changes and content is hidden
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Expandir sala de espera/i })
      ).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Live timer re-render
  // -------------------------------------------------------------------------

  it("re-renders wait times after the 30-second tick interval", async () => {
    mockFetchSuccess([makeAppointment()]);

    renderWithQuery(<WaitingRoom />);

    // Wait for initial render
    await screen.findByText("João Silva");

    const initialCount = Number(
      document.querySelectorAll("[aria-label^='Tempo de espera']").length
    );

    // Advance timer by 30 seconds to trigger the tick
    vi.advanceTimersByTime(30_000);

    await waitFor(() => {
      expect(
        document.querySelectorAll("[aria-label^='Tempo de espera']").length
      ).toBe(initialCount);
    });
  });

  // -------------------------------------------------------------------------
  // API query parameters
  // -------------------------------------------------------------------------

  it("calls the API with status=arrived and today's date", async () => {
    mockFetchSuccess([]);

    renderWithQuery(<WaitingRoom />);

    await screen.findByText("Nenhum paciente na sala de espera");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/status=arrived/),
      expect.objectContaining({ credentials: "include" })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/date=\d{4}-\d{2}-\d{2}/),
      expect.anything()
    );
  });
});
