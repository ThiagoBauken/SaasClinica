import { ReactNode, lazy } from "react";

export interface FrontendModuleInfo {
  name: string;
  displayName: string;
  description: string;
  version: string;
  routes: ModuleRoute[];
  menuItems: ModuleMenuItem[];
  isEnabled: boolean;
}

export interface ModuleRoute {
  path: string;
  component: React.ComponentType<any>;
  requiredPermissions?: string[];
  exact?: boolean;
}

export interface ModuleMenuItem {
  path: string;
  label: string;
  icon: ReactNode;
  requiredPermissions?: string[];
  order?: number;
}

class ModuleLoader {
  private loadedModules: Map<string, FrontendModuleInfo> = new Map();
  private userModules: string[] = [];

  async loadUserModules(userCompanyId: number) {
    try {
      const response = await fetch(`/api/modules/user/${userCompanyId}/enabled`);
      if (!response.ok) throw new Error('Failed to fetch user modules');
      
      const enabledModules = await response.json();
      this.userModules = enabledModules.map((m: any) => m.name);
      
      // Load each enabled module
      for (const moduleName of this.userModules) {
        await this.loadModule(moduleName);
      }
    } catch (error) {
      console.error('Error loading user modules:', error);
    }
  }

  private async loadModule(moduleName: string) {
    try {
      // Dynamic import of module
      const moduleDefinition = await import(`@/modules/${moduleName}/index.tsx`);
      
      if (moduleDefinition.default) {
        this.loadedModules.set(moduleName, moduleDefinition.default);
        console.log(`✅ Frontend module ${moduleName} loaded successfully`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load frontend module ${moduleName}:`, error);
    }
  }

  getModuleRoutes(): ModuleRoute[] {
    const routes: ModuleRoute[] = [];
    
    for (const [moduleName, moduleInfo] of this.loadedModules) {
      if (moduleInfo.isEnabled) {
        routes.push(...moduleInfo.routes);
      }
    }
    
    return routes;
  }

  getModuleMenuItems(): ModuleMenuItem[] {
    const menuItems: ModuleMenuItem[] = [];
    
    for (const [moduleName, moduleInfo] of this.loadedModules) {
      if (moduleInfo.isEnabled) {
        menuItems.push(...moduleInfo.menuItems);
      }
    }
    
    // Sort by order if specified
    return menuItems.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  isModuleEnabled(moduleName: string): boolean {
    return this.userModules.includes(moduleName);
  }

  getLoadedModules(): FrontendModuleInfo[] {
    return Array.from(this.loadedModules.values()).filter(m => m.isEnabled);
  }
}

export const moduleLoader = new ModuleLoader();