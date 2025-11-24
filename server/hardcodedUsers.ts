import { User } from "@shared/schema";

// Usuários fixos para teste
// IMPORTANTE: Senhas agora são armazenadas com hash Scrypt para segurança
// Senhas originais: admin123, dentista123
export const fixedUsers: User[] = [
  {
    id: 99999,
    username: "admin",
    password: "ba10962000964932eaf5e6faadb81a2f5edc59b60834ed26a5a38cf2cb49d910e02533c143dec138aeee6dab7932ff6504000223cc40e12bd43e308588bc269b.191c1677479734de10a5bcfdb1b506f3", // admin123
    fullName: "Administrador",
    email: "admin@dentalclinic.com",
    role: "admin",
    phone: null,
    profileImageUrl: null,
    speciality: null,
    active: true,
    googleId: null,
    googleCalendarId: null,
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiry: null,
    wuzapiPhone: null,
    cfoRegistrationNumber: null,
    cfoState: null,
    digitalCertificatePath: null,
    companyId: 1, // Use the correct company ID from database
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 99998,
    username: "dentista",
    password: "5396b59ca4975e94eb83f5fa1f36badbd144115624c3834f78401a509e21ae49275f0dfe6364c99078000cd75b7b206199227379858958aa6efd9712a0418214.b719ef1765e7329c35f85d83ad42ffa7", // dentista123
    fullName: "Dr. Dentista",
    email: "dentista@dentalclinic.com",
    role: "dentist",
    phone: null,
    profileImageUrl: null,
    speciality: "Clínico Geral",
    active: true,
    googleId: null,
    googleCalendarId: null,
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiry: null,
    wuzapiPhone: null,
    cfoRegistrationNumber: null,
    cfoState: null,
    digitalCertificatePath: null,
    companyId: 1, // Use the correct company ID from database
    trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 dias
    createdAt: new Date(),
    updatedAt: new Date()
  }
];