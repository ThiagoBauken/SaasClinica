import { ArrowDown, ArrowUp, ArrowUpDown, ShieldCheck, ShieldOff, Lock, Mail, MailCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminUser } from "./types";

interface Props {
  data: AdminUser[];
  isLoading: boolean;
  selectedIds: Set<number>;
  onToggleOne: (id: number) => void;
  onToggleAll: (allOnPage: boolean) => void;
  onOpenDetail: (user: AdminUser) => void;
  sort: { sortBy?: string; sortOrder?: "asc" | "desc" };
  onSort: (column: string) => void;
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  dentist: "Dentista",
  staff: "Equipe",
  receptionist: "Recepção",
  assistant: "Assistente",
};

const ROLE_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  superadmin: "destructive",
  admin: "default",
  dentist: "secondary",
  staff: "outline",
  receptionist: "outline",
  assistant: "outline",
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: string;
  sort: Props["sort"];
  onSort: Props["onSort"];
}) {
  const active = sort.sortBy === column;
  return (
    <button
      type="button"
      className="flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => onSort(column)}
    >
      {label}
      {active ? (
        sort.sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

export function UsersTable({
  data,
  isLoading,
  selectedIds,
  onToggleOne,
  onToggleAll,
  onOpenDetail,
  sort,
  onSort,
}: Props) {
  const allSelected = data.length > 0 && data.every((u) => selectedIds.has(u.id));
  const someSelected = data.some((u) => selectedIds.has(u.id));

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => onToggleAll(allSelected)}
                aria-label={allSelected ? "Desmarcar todos" : "Selecionar todos"}
                className={someSelected && !allSelected ? "opacity-60" : ""}
              />
            </TableHead>
            <TableHead><SortHeader label="Nome" column="fullName" sort={sort} onSort={onSort} /></TableHead>
            <TableHead><SortHeader label="E-mail" column="email" sort={sort} onSort={onSort} /></TableHead>
            <TableHead><SortHeader label="Função" column="role" sort={sort} onSort={onSort} /></TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center">Segurança</TableHead>
            <TableHead><SortHeader label="Último login" column="lastLoginAt" sort={sort} onSort={onSort} /></TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                Carregando...
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                Nenhum usuário encontrado com os filtros atuais.
              </TableCell>
            </TableRow>
          ) : (
            data.map((u) => {
              const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
              return (
                <TableRow
                  key={u.id}
                  className={selectedIds.has(u.id) ? "bg-muted/40" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(u.id)}
                      onCheckedChange={() => onToggleOne(u.id)}
                      aria-label={`Selecionar ${u.fullName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{u.fullName}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[u.role] ?? "outline"}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{u.companyName ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={u.active ? "default" : "secondary"}>
                      {u.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1 text-muted-foreground">
                      {u.totpEnabled ? (
                        <ShieldCheck className="h-4 w-4 text-green-600" aria-label="MFA habilitado" />
                      ) : (
                        <ShieldOff className="h-4 w-4 opacity-50" aria-label="MFA desabilitado" />
                      )}
                      {u.emailVerified ? (
                        <MailCheck className="h-4 w-4 text-green-600" aria-label="E-mail verificado" />
                      ) : (
                        <Mail className="h-4 w-4 opacity-50" aria-label="E-mail não verificado" />
                      )}
                      {locked && <Lock className="h-4 w-4 text-destructive" aria-label="Bloqueado" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(u.lastLoginAt)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => onOpenDetail(u)}>
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
