import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Cache configuration
      staleTime: 5 * 60 * 1000, // 5 minutos - dados são considerados frescos por este período
      gcTime: 10 * 60 * 1000, // 10 minutos - mantém dados em cache por este período (antes era cacheTime)

      // Refetch strategies
      refetchInterval: false, // Não refazer automaticamente
      refetchOnWindowFocus: false, // Não refazer ao focar janela (evita requests desnecessários)
      refetchOnReconnect: true, // Refazer quando reconectar à internet
      refetchOnMount: true, // Refazer ao montar componente se dados estiverem stale

      // Retry configuration
      retry: 1, // Tentar 1 vez em caso de falha
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

      // Performance
      networkMode: 'online', // Só fazer requests quando online
    },
    mutations: {
      retry: false, // Mutations não devem fazer retry automático
      networkMode: 'online',
    },
  },
});

// Configurações específicas para diferentes tipos de dados
export const queryOptions = {
  // Dados que mudam raramente (configurações, listas de referência)
  static: {
    staleTime: 30 * 60 * 1000, // 30 minutos
    gcTime: 60 * 60 * 1000, // 1 hora
  },

  // Dados que mudam frequentemente (agendamentos, notificações)
  dynamic: {
    staleTime: 1 * 60 * 1000, // 1 minuto
    gcTime: 5 * 60 * 1000, // 5 minutos
  },

  // Dados em tempo real (complemento ao WebSocket)
  realtime: {
    staleTime: 0, // Sempre stale, sempre refetch
    gcTime: 2 * 60 * 1000, // 2 minutos
    refetchInterval: 30000, // Refetch a cada 30 segundos como fallback
  },

  // Dados infinitos (listas paginadas)
  infinite: {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
};
