import DashboardLayout from "@/layouts/DashboardLayout";
import { UsersTab } from "@/pages/admin/users/UsersTab";

/**
 * Painel de gerenciamento de usuários da clínica.
 * Reusa o componente compartilhado UsersTab — mesma UI do SuperAdmin,
 * porém escopado automaticamente à empresa do usuário logado pelo backend.
 */
export default function ConfiguracoesUsuariosPage() {
  return (
    <DashboardLayout title="Usuários e Permissões" currentPath="/configuracoes/usuarios">
      <div className="container mx-auto py-6">
        <UsersTab />
      </div>
    </DashboardLayout>
  );
}
