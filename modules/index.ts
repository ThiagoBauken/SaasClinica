// Module registry - re-exports from moduleManager
import { moduleManager } from "../server/core/moduleManager";

export const moduleRegistry = {
  getModule(name: string): any {
    return (moduleManager as any).loadedModules?.get(name)?.info || null;
  },
  getAllModules(): any[] {
    return Array.from((moduleManager as any).loadedModules?.values() || []).map((m: any) => m.info);
  },
  getModulesByCategory(): Record<string, any[]> {
    const all = this.getAllModules();
    const grouped: Record<string, any[]> = {};
    for (const mod of all) {
      const cat = mod.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(mod);
    }
    return grouped;
  },
  activate(moduleId: string): boolean {
    const mod = (moduleManager as any).loadedModules?.get(moduleId);
    if (mod) {
      mod.info.isLoaded = true;
      return true;
    }
    return false;
  },
  deactivate(moduleId: string): boolean {
    const mod = (moduleManager as any).loadedModules?.get(moduleId);
    if (mod) {
      mod.info.isLoaded = false;
      return true;
    }
    return false;
  },
  isModuleEnabled(moduleName: string, companyId: number) {
    return true; // Default to enabled for now
  }
};
