import { Tooth } from "@/lib/types";

// Dados dos dentes permanentes
export const permanentTeeth: Tooth[] = [
  // Quadrante Superior Direito (1)
  { id: 1, number: "18", type: "permanente", group: "molar", position: "superior" },
  { id: 2, number: "17", type: "permanente", group: "molar", position: "superior" },
  { id: 3, number: "16", type: "permanente", group: "molar", position: "superior" },
  { id: 4, number: "15", type: "permanente", group: "premolar", position: "superior" },
  { id: 5, number: "14", type: "permanente", group: "premolar", position: "superior" },
  { id: 6, number: "13", type: "permanente", group: "canino", position: "superior" },
  { id: 7, number: "12", type: "permanente", group: "incisivo", position: "superior" },
  { id: 8, number: "11", type: "permanente", group: "incisivo", position: "superior" },
  
  // Quadrante Superior Esquerdo (2)
  { id: 9, number: "21", type: "permanente", group: "incisivo", position: "superior" },
  { id: 10, number: "22", type: "permanente", group: "incisivo", position: "superior" },
  { id: 11, number: "23", type: "permanente", group: "canino", position: "superior" },
  { id: 12, number: "24", type: "permanente", group: "premolar", position: "superior" },
  { id: 13, number: "25", type: "permanente", group: "premolar", position: "superior" },
  { id: 14, number: "26", type: "permanente", group: "molar", position: "superior" },
  { id: 15, number: "27", type: "permanente", group: "molar", position: "superior" },
  { id: 16, number: "28", type: "permanente", group: "molar", position: "superior" },
  
  // Quadrante Inferior Esquerdo (3)
  { id: 17, number: "38", type: "permanente", group: "molar", position: "inferior" },
  { id: 18, number: "37", type: "permanente", group: "molar", position: "inferior" },
  { id: 19, number: "36", type: "permanente", group: "molar", position: "inferior" },
  { id: 20, number: "35", type: "permanente", group: "premolar", position: "inferior" },
  { id: 21, number: "34", type: "permanente", group: "premolar", position: "inferior" },
  { id: 22, number: "33", type: "permanente", group: "canino", position: "inferior" },
  { id: 23, number: "32", type: "permanente", group: "incisivo", position: "inferior" },
  { id: 24, number: "31", type: "permanente", group: "incisivo", position: "inferior" },
  
  // Quadrante Inferior Direito (4)
  { id: 25, number: "41", type: "permanente", group: "incisivo", position: "inferior" },
  { id: 26, number: "42", type: "permanente", group: "incisivo", position: "inferior" },
  { id: 27, number: "43", type: "permanente", group: "canino", position: "inferior" },
  { id: 28, number: "44", type: "permanente", group: "premolar", position: "inferior" },
  { id: 29, number: "45", type: "permanente", group: "premolar", position: "inferior" },
  { id: 30, number: "46", type: "permanente", group: "molar", position: "inferior" },
  { id: 31, number: "47", type: "permanente", group: "molar", position: "inferior" },
  { id: 32, number: "48", type: "permanente", group: "molar", position: "inferior" },
];

// Dados dos dentes decíduos
export const deciduousTeeth: Tooth[] = [
  // Quadrante Superior Direito (5)
  { id: 33, number: "55", type: "deciduo", group: "molar", position: "superior" },
  { id: 34, number: "54", type: "deciduo", group: "molar", position: "superior" },
  { id: 35, number: "53", type: "deciduo", group: "canino", position: "superior" },
  { id: 36, number: "52", type: "deciduo", group: "incisivo", position: "superior" },
  { id: 37, number: "51", type: "deciduo", group: "incisivo", position: "superior" },
  
  // Quadrante Superior Esquerdo (6)
  { id: 38, number: "61", type: "deciduo", group: "incisivo", position: "superior" },
  { id: 39, number: "62", type: "deciduo", group: "incisivo", position: "superior" },
  { id: 40, number: "63", type: "deciduo", group: "canino", position: "superior" },
  { id: 41, number: "64", type: "deciduo", group: "molar", position: "superior" },
  { id: 42, number: "65", type: "deciduo", group: "molar", position: "superior" },
  
  // Quadrante Inferior Esquerdo (7)
  { id: 43, number: "75", type: "deciduo", group: "molar", position: "inferior" },
  { id: 44, number: "74", type: "deciduo", group: "molar", position: "inferior" },
  { id: 45, number: "73", type: "deciduo", group: "canino", position: "inferior" },
  { id: 46, number: "72", type: "deciduo", group: "incisivo", position: "inferior" },
  { id: 47, number: "71", type: "deciduo", group: "incisivo", position: "inferior" },
  
  // Quadrante Inferior Direito (8)
  { id: 48, number: "81", type: "deciduo", group: "incisivo", position: "inferior" },
  { id: 49, number: "82", type: "deciduo", group: "incisivo", position: "inferior" },
  { id: 50, number: "83", type: "deciduo", group: "canino", position: "inferior" },
  { id: 51, number: "84", type: "deciduo", group: "molar", position: "inferior" },
  { id: 52, number: "85", type: "deciduo", group: "molar", position: "inferior" },
];

// Procedimentos possíveis para odontograma
export const odontogramProcedures = [
  { id: 1, name: "Restauração", color: "#cceeff" },
  { id: 2, name: "Cárie", color: "#ffcccc" },
  { id: 3, name: "Extração", color: "#ffdddd" },
  { id: 4, name: "Implante", color: "#e6e6e6" },
  { id: 5, name: "Tratamento de Canal", color: "#ffe0cc" },
  { id: 6, name: "Coroa", color: "#d8f7c8" },
  { id: 7, name: "Prótese", color: "#e0eaff" },
];