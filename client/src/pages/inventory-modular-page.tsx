import DashboardLayout from "@/layouts/DashboardLayout";
import EstoqueModular from "@/modules/clinica/estoque/EstoqueModular";

export default function InventoryModularPage() {
  return (
    <DashboardLayout title="Estoque" currentPath="/inventory-modular">
      <EstoqueModular />
    </DashboardLayout>
  );
}