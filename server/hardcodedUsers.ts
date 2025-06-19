import { User } from "@shared/schema";

// Usuários fixos para teste
export const fixedUsers: User[] = [
  {
    id: 2,
    username: "admin",
    password: "admin123",
    fullName: "Administrador",
    email: "admin@dentalclinic.com",
    role: "admin",
    phone: null,
    profileImageUrl: null,
    speciality: null,
    active: true,
    googleId: null,
    companyId: 1, // Use the correct company ID from database
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 1,
    username: "dentista",
    password: "dentista123",
    fullName: "Dr. Dentista",
    email: "dentista@dentalclinic.com",
    role: "dentist",
    phone: null,
    profileImageUrl: null,
    speciality: "Clínico Geral",
    active: true,
    googleId: null,
    companyId: 1, // Use the correct company ID from database
    trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 dias
    createdAt: new Date(),
    updatedAt: new Date()
  }
];