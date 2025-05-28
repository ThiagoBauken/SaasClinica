import { User } from "@shared/schema";

// Usuários fixos para teste
export const fixedUsers: User[] = [
  {
    id: 99999,
    companyId: 1,
    username: "admin",
    password: "admin123",
    fullName: "Administrador",
    email: "admin@dentalsys.com",
    role: "superadmin",
    phone: null,
    profileImageUrl: null,
    speciality: null,
    active: true,
    googleId: null,
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 99998,
    companyId: 1,
    username: "dentista",
    password: "dentista123",
    fullName: "Dr. Dentista",
    email: "dentista@dentalsys.com",
    role: "dentist",
    phone: null,
    profileImageUrl: null,
    speciality: "Clínico Geral",
    active: true,
    googleId: null,
    trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 dias
    createdAt: new Date(),
    updatedAt: new Date()
  }
];