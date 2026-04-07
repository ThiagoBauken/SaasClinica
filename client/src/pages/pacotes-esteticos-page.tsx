import DashboardLayout from "@/layouts/DashboardLayout";
import AestheticPackages from "@/components/aesthetic/AestheticPackages";

export default function PacotesEsteticosPage() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <AestheticPackages />
      </div>
    </DashboardLayout>
  );
}
