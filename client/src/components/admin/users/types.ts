/**
 * Tipos compartilhados pelos componentes admin/users.
 * Espelha a forma retornada pelos endpoints de `/api/admin-panel/users`.
 */
export interface AdminUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "superadmin" | "admin" | "dentist" | "staff" | "receptionist" | "assistant" | string;
  active: boolean;
  companyId: number;
  companyName: string | null;
  emailVerified: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  failedLoginCount: number;
  lockedUntil: string | null;
  deletedAt: string | null;
  profileImageUrl: string | null;
  speciality: string | null;
  adminNotes: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserFilters {
  q?: string;
  role?: string;
  active?: "true" | "false";
  companyId?: string;
  mfa?: "true" | "false";
  verified?: "true" | "false";
  locked?: "true" | "false";
}

export interface AdminUserSession {
  sid: string;
  expire: string;
  maxAge: number | null;
}

export interface AuditLogEntry {
  id: number;
  companyId: number;
  userId: number;
  action: string;
  resourceType: string;
  resourceId: number | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actorUsername: string | null;
  actorFullName: string | null;
}
