import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

interface UsePaginatedQueryOptions {
  /** Endpoint base (ex: `/api/admin-panel/users`). */
  endpoint: string;
  /** queryKey base usada pelo react-query. */
  queryKey: unknown[];
  /** Filtros aplicados. Mudanças zeram a página. */
  filters?: Record<string, string | undefined>;
  /** Página inicial (default 1). */
  initialPage?: number;
  /** Limite por página (default 25). */
  initialLimit?: number;
  /** Sort inicial. */
  initialSort?: { sortBy?: string; sortOrder?: "asc" | "desc" };
  /** Habilita ou desabilita o fetch. */
  enabled?: boolean;
}

/**
 * Hook reusável para listas paginadas com filtros + sort.
 * Usa o backend `paginationSchema` (campos `page`, `limit`, `sortBy`, `sortOrder`).
 */
export function usePaginatedQuery<T>(opts: UsePaginatedQueryOptions) {
  const [page, setPage] = useState(opts.initialPage ?? 1);
  const [limit, setLimit] = useState(opts.initialLimit ?? 25);
  const [sort, setSort] = useState<{ sortBy?: string; sortOrder?: "asc" | "desc" }>(
    opts.initialSort ?? { sortOrder: "desc" },
  );

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (sort.sortBy) params.set("sortBy", sort.sortBy);
  if (sort.sortOrder) params.set("sortOrder", sort.sortOrder);
  for (const [k, v] of Object.entries(opts.filters ?? {})) {
    if (v !== undefined && v !== "") params.set(k, v);
  }
  const url = `${opts.endpoint}?${params.toString()}`;

  const query = useQuery<PaginatedResponse<T>>({
    queryKey: [...opts.queryKey, page, limit, sort.sortBy, sort.sortOrder, opts.filters],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar lista");
      return res.json();
    },
    enabled: opts.enabled ?? true,
  });

  const toggleSort = useCallback((column: string) => {
    setSort((s) => {
      if (s.sortBy === column) {
        return { sortBy: column, sortOrder: s.sortOrder === "asc" ? "desc" : "asc" };
      }
      return { sortBy: column, sortOrder: "asc" };
    });
  }, []);

  return {
    data: query.data?.data ?? [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    page,
    limit,
    sort,
    setPage,
    setLimit,
    setSort,
    toggleSort,
    /** Reset page to 1 — usar quando filtros mudam externamente. */
    resetPage: () => setPage(1),
  };
}
