import DashboardLayout from "@/layouts/DashboardLayout";
import { ModularWrapper } from "@/components/ModularWrapper";
import AgendaModular from "@/modules/clinica/agenda/AgendaModular";

// Importar a página atual como componente legado
import SchedulePage from "@/pages/schedule-page";

// Extrair apenas o conteúdo da agenda (sem DashboardLayout)
const LegacyScheduleContent = () => {
  // Re-implementar apenas o conteúdo essencial sem o layout
  return (
    <div>
      {/* Conteúdo da agenda atual será mantido aqui */}
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Agenda Atual (Sistema Legado)</h2>
        <p className="text-muted-foreground">
          Esta é a versão atual da agenda que está funcionando. 
          Use o toggle para alternar entre a versão atual e a nova versão modular.
        </p>
      </div>
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