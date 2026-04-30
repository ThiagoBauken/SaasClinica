import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/core/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { UsersFilterBar } from "@/components/admin/users/UsersFilterBar";
import { UsersTable } from "@/components/admin/users/UsersTable";
import { UsersBulkActionsBar } from "@/components/admin/users/UsersBulkActionsBar";
import { UserDetailDrawer } from "@/components/admin/users/UserDetailDrawer";
import { InviteUserDialog } from "@/components/admin/users/InviteUserDialog";
import type { AdminUser, AdminUserFilters } from "@/components/admin/users/types";

interface Props {
  /** Quando true, mostra filtro de empresa e amplia escopo (usado em /superadmin). */
  superadminScope?: boolean;
}

export function UsersTab({ superadminScope }: Props) {
  const { user: currentUser } = useAuth();
  const [filters, setFilters] = useState<AdminUserFilters>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);

  const queryKeyBase = useMemo(() => ["admin", "users", superadminScope ? "all" : "company"], [superadminScope]);

  const q = usePaginatedQuery<AdminUser>({
    endpoint: "/api/admin-panel/users",
    queryKey: queryKeyBase,
    filters: filters as Record<string, string | undefined>,
    initialLimit: 25,
  });

  const onChangeFilters = useCallback(
    (next: AdminUserFilters) => {
      setFilters(next);
      q.resetPage();
      setSelectedIds(new Set());
    },
    [q],
  );

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (allOnPage: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPage) {
        for (const u of q.data) next.delete(u.id);
      } else {
        for (const u of q.data) next.add(u.id);
      }
      return next;
    });
  };

  // CSV export URL com filtros atuais
  const csvParams = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) csvParams.set(k, v as string);
  }
  const csvUrl = `/api/admin-panel/users/export.csv?${csvParams.toString()}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>
                {superadminScope
                  ? "Gerencie todos os usuários da plataforma"
                  : "Gerencie os usuários da sua clínica"}
              </CardDescription>
            </div>
          </div>
          <InviteUserDialog />
        </div>
      </CardHeader>
      <CardContent>
        <UsersFilterBar
          filters={filters}
          onChange={onChangeFilters}
          showCompanyFilter={superadminScope}
          exportHref={csvUrl}
        />

        <UsersTable
          data={q.data}
          isLoading={q.isLoading}
          selectedIds={selectedIds}
          onToggleOne={toggleOne}
          onToggleAll={toggleAll}
          onOpenDetail={setDetailUser}
          sort={q.sort}
          onSort={q.toggleSort}
        />

        {/* Paginação */}
        {q.pagination && q.pagination.total > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <div className="text-muted-foreground">
              Página {q.pagination.page} de {q.pagination.totalPages} ·{" "}
              {q.pagination.total} usuário(s)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!q.pagination.hasPrevPage || q.isFetching}
                onClick={() => q.setPage(q.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!q.pagination.hasNextPage || q.isFetching}
                onClick={() => q.setPage(q.page + 1)}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <UsersBulkActionsBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
        invalidateKey={queryKeyBase}
      />

      <UserDetailDrawer
        user={detailUser}
        onClose={() => setDetailUser(null)}
        invalidateKey={queryKeyBase}
        currentUserId={currentUser?.id ?? 0}
        isSuperadmin={currentUser?.role === "superadmin"}
      />
    </Card>
  );
}
