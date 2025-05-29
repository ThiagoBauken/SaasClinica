import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface ModularWrapperProps {
  moduleName: string;
  legacyComponent: React.ComponentType;
  modularComponent?: React.ComponentType;
  isModuleActive?: boolean;
  children?: React.ReactNode;
}

export function ModularWrapper({ 
  moduleName, 
  legacyComponent: LegacyComponent, 
  modularComponent: ModularComponent,
  isModuleActive = false,
  children 
}: ModularWrapperProps) {
  const [useModular, setUseModular] = useState(isModuleActive);
  const [showToggle, setShowToggle] = useState(false);

  // Se não há componente modular, usar sempre o legado
  if (!ModularComponent) {
    return <LegacyComponent />;
  }

  return (
    <div className="relative">
      {/* Toggle de desenvolvimento (apenas para admin) */}
      <div className="absolute top-4 right-4 z-50 flex items-center space-x-2">
        <Badge variant={useModular ? "default" : "secondary"}>
          {useModular ? "Modular" : "Legado"}
        </Badge>
        
        {showToggle && (
          <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border">
            <span className="text-sm">Modo:</span>
            <Switch
              checked={useModular}
              onCheckedChange={setUseModular}
            />
            <span className="text-sm">{useModular ? "Novo" : "Atual"}</span>
          </div>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowToggle(!showToggle)}
        >
          ⚙️
        </Button>
      </div>

      {/* Renderizar componente baseado na escolha */}
      {useModular ? (
        <div>
          <ModularComponent />
          {children}
        </div>
      ) : (
        <LegacyComponent />
      )}
    </div>
  );
}