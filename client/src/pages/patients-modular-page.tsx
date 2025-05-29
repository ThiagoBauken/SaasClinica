import DashboardLayout from "@/layouts/DashboardLayout";
import PacientesModular from "@/modules/clinica/pacientes/PacientesModular";

export default function PatientsModularPage() {
  return (
    <DashboardLayout title="Pacientes" currentPath="/patients-modular">
      <PacientesModular />
    </DashboardLayout>
  );
}