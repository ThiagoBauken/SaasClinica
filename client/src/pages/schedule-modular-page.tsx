import DashboardLayout from "@/layouts/DashboardLayout";
import { ModularWrapper } from "@/components/ModularWrapper";
import AgendaModular from "@/modules/clinica/agenda/AgendaModular";

// Importar a página atual como componente legado
import SchedulePage from "@/pages/schedule-page";

// Componente que usa os mesmos componentes da agenda atual
const LegacyScheduleContent = () => {
  return (
    <div className="h-full">
      <iframe 
        src="/schedule" 
        className="w-full h-full border-0"
        title="Agenda Atual"
      />
    </div>
  );
};

export default function ScheduleModularPage() {
  return (
    <DashboardLayout title="Agenda Modular" currentPath="/schedule-modular">
      <ModularWrapper
        moduleName="agenda"
        legacyComponent={LegacyScheduleContent}
        modularComponent={AgendaModular}
        isModuleActive={false} // Começa com o legado por segurança
      />
    </DashboardLayout>
  );
}