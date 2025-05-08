import DashboardLayout from "@/layouts/DashboardLayout";
import OdontogramDemo from "@/components/odontogram/OdontogramDemo";

export default function OdontogramDemoPage() {
  return (
    <DashboardLayout title="Demonstração de Odontograma" currentPath="/odontogram-demo">
      <div className="bg-card rounded-lg border border-border p-6">
        <p className="mb-4 text-muted-foreground">
          Esta é uma demonstração do componente de odontograma com formatos realistas dos dentes.
          Clique no botão abaixo para abrir o odontograma e teste as funcionalidades.
        </p>
        
        <OdontogramDemo />
      </div>
    </DashboardLayout>
  );
}