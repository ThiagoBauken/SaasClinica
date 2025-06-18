import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/core/AuthProvider";

export type UserRole = "admin" | "secretary" | "dentist" | "assistant";

interface UserPermissions {
  // Visibilidade de agenda
  canViewAllAppointments: boolean;
  canViewOwnAppointments: boolean;
  restrictedToProfessionalId?: number;
  
  // Gerenciamento de agendamentos
  canCreateAppointments: boolean;
  canEditAppointments: boolean;
  canDeleteAppointments: boolean;
  canConfirmAppointments: boolean;
  
  // Gerenciamento de pacientes
  canAccessPatientData: boolean;
  canCreatePatients: boolean;
  canEditPatients: boolean;
  
  // Configurações
  canManageClinicSettings: boolean;
  canManageProfessionals: boolean;
  canManageRooms: boolean;
}

interface PermissionContextType {
  userRole: UserRole;
  permissions: UserPermissions;
  isLoading: boolean;
  canUserViewProfessionalAppointments: (professionalId: number) => boolean;
  canUserAccessFeature: (feature: string) => boolean;
}

const defaultPermissions: UserPermissions = {
  canViewAllAppointments: false,
  canViewOwnAppointments: false,
  canCreateAppointments: false,
  canEditAppointments: false,
  canDeleteAppointments: false,
  canConfirmAppointments: false,
  canAccessPatientData: false,
  canCreatePatients: false,
  canEditPatients: false,
  canManageClinicSettings: false,
  canManageProfessionals: false,
  canManageRooms: false
};

const PermissionContext = createContext<PermissionContextType>({
  userRole: "assistant",
  permissions: defaultPermissions,
  isLoading: true,
  canUserViewProfessionalAppointments: () => false,
  canUserAccessFeature: () => false,
});

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>("assistant");
  const [permissions, setPermissions] = useState<UserPermissions>(defaultPermissions);

  useEffect(() => {
    // Em um ambiente real, buscaríamos as permissões do usuário da API
    // Aqui, estamos simulando com base no tipo de usuário
    if (user) {
      const role = determineUserRole(user);
      setUserRole(role);
      setPermissions(generatePermissionsForRole(role, user));
      setIsLoading(false);
    }
  }, [user]);

  // Determina função do usuário com base nos dados do usuário
  const determineUserRole = (user: any): UserRole => {
    // Aqui você implementaria a lógica para determinar a função do usuário
    // baseada nos dados do usuário ou em alguma configuração
    if (user.role) return user.role as UserRole;
    
    // Fallback - para demonstração
    if (user.email === "admin@exemplo.com") return "admin";
    if (user.email === "secretaria@exemplo.com") return "secretary";
    if (user.professionalId) return "dentist";
    return "assistant";
  };

  // Gera permissões baseadas na função do usuário
  const generatePermissionsForRole = (role: UserRole, user: any): UserPermissions => {
    switch (role) {
      case "admin":
        return {
          canViewAllAppointments: true,
          canViewOwnAppointments: true,
          canCreateAppointments: true,
          canEditAppointments: true,
          canDeleteAppointments: true,
          canConfirmAppointments: true,
          canAccessPatientData: true,
          canCreatePatients: true,
          canEditPatients: true,
          canManageClinicSettings: true,
          canManageProfessionals: true,
          canManageRooms: true
        };
      
      case "secretary":
        return {
          canViewAllAppointments: true,
          canViewOwnAppointments: true,
          canCreateAppointments: true,
          canEditAppointments: true,
          canDeleteAppointments: true,
          canConfirmAppointments: true,
          canAccessPatientData: true,
          canCreatePatients: true,
          canEditPatients: true,
          canManageClinicSettings: false,
          canManageProfessionals: false,
          canManageRooms: true
        };
      
      case "dentist":
        return {
          canViewAllAppointments: false,
          canViewOwnAppointments: true,
          restrictedToProfessionalId: user.professionalId,
          canCreateAppointments: true,
          canEditAppointments: true,
          canDeleteAppointments: false,
          canConfirmAppointments: true,
          canAccessPatientData: true,
          canCreatePatients: false,
          canEditPatients: false,
          canManageClinicSettings: false,
          canManageProfessionals: false,
          canManageRooms: false
        };
      
      case "assistant":
        return {
          canViewAllAppointments: false,
          canViewOwnAppointments: false,
          canCreateAppointments: false,
          canEditAppointments: false,
          canDeleteAppointments: false,
          canConfirmAppointments: false,
          canAccessPatientData: true,
          canCreatePatients: false,
          canEditPatients: false,
          canManageClinicSettings: false,
          canManageProfessionals: false,
          canManageRooms: false
        };
      
      default:
        return defaultPermissions;
    }
  };

  // Verifica se o usuário pode visualizar os agendamentos de um profissional específico
  const canUserViewProfessionalAppointments = (professionalId: number): boolean => {
    // Administradores e secretárias podem ver todos os agendamentos
    if (permissions.canViewAllAppointments) return true;
    
    // Dentistas só podem ver seus próprios agendamentos
    if (permissions.canViewOwnAppointments && permissions.restrictedToProfessionalId === professionalId) {
      return true;
    }
    
    return false;
  };

  // Verifica se o usuário tem permissão para acessar uma funcionalidade específica
  const canUserAccessFeature = (feature: string): boolean => {
    switch (feature) {
      case "createAppointment": return permissions.canCreateAppointments;
      case "editAppointment": return permissions.canEditAppointments;
      case "deleteAppointment": return permissions.canDeleteAppointments;
      case "confirmAppointment": return permissions.canConfirmAppointments;
      case "accessPatientData": return permissions.canAccessPatientData;
      case "createPatient": return permissions.canCreatePatients;
      case "editPatient": return permissions.canEditPatients;
      case "manageClinicSettings": return permissions.canManageClinicSettings;
      case "manageProfessionals": return permissions.canManageProfessionals;
      case "manageRooms": return permissions.canManageRooms;
      default: return false;
    }
  };

  return (
    <PermissionContext.Provider 
      value={{ 
        userRole, 
        permissions, 
        isLoading,
        canUserViewProfessionalAppointments,
        canUserAccessFeature
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionContext);