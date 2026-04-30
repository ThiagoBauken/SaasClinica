import { Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminUserFilters } from "./types";

interface Props {
  filters: AdminUserFilters;
  onChange: (next: AdminUserFilters) => void;
  /** Mostra o filtro de empresa (apenas para superadmin). */
  showCompanyFilter?: boolean;
  exportHref?: string;
}

const ALL = "__all__";

export function UsersFilterBar({ filters, onChange, showCompanyFilter, exportHref }: Props) {
  const set = (k: keyof AdminUserFilters, v: string | undefined) => {
    const next = { ...filters };
    if (v === undefined || v === "" || v === ALL) delete next[k];
    else (next as any)[k] = v;
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, usuário ou e-mail..."
          className="pl-9"
          value={filters.q ?? ""}
          onChange={(e) => set("q", e.target.value || undefined)}
        />
      </div>

      <Select value={filters.role ?? ALL} onValueChange={(v) => set("role", v === ALL ? undefined : v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Função" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas funções</SelectItem>
          <SelectItem value="superadmin">Superadmin</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="dentist">Dentista</SelectItem>
          <SelectItem value="staff">Equipe</SelectItem>
          <SelectItem value="receptionist">Recepção</SelectItem>
          <SelectItem value="assistant">Assistente</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.active ?? ALL} onValueChange={(v) => set("active", v === ALL ? undefined : (v as any))}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          <SelectItem value="true">Ativo</SelectItem>
          <SelectItem value="false">Inativo</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.verified ?? ALL} onValueChange={(v) => set("verified", v === ALL ? undefined : (v as any))}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="E-mail" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          <SelectItem value="true">Verificado</SelectItem>
          <SelectItem value="false">Pendente</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.mfa ?? ALL} onValueChange={(v) => set("mfa", v === ALL ? undefined : (v as any))}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="MFA" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          <SelectItem value="true">Com MFA</SelectItem>
          <SelectItem value="false">Sem MFA</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.locked ?? ALL} onValueChange={(v) => set("locked", v === ALL ? undefined : (v as any))}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Bloqueio" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          <SelectItem value="true">Bloqueados</SelectItem>
          <SelectItem value="false">Desbloqueados</SelectItem>
        </SelectContent>
      </Select>

      {showCompanyFilter && (
        <Input
          placeholder="ID empresa"
          className="w-[120px]"
          value={filters.companyId ?? ""}
          onChange={(e) => set("companyId", e.target.value || undefined)}
        />
      )}

      {exportHref && (
        <Button asChild variant="outline">
          <a href={exportHref}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </a>
        </Button>
      )}
    </div>
  );
}
