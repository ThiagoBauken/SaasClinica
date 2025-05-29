import DashboardLayout from "@/layouts/DashboardLayout";
import FinanceiroModular from "@/modules/clinica/financeiro/FinanceiroModular";

export default function FinancialModularPage() {
  return (
    <DashboardLayout title="Financeiro" currentPath="/financial-modular">
      <FinanceiroModular />
    </DashboardLayout>
  );
}