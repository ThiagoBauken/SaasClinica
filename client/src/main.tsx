import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "next-themes";

// Add title and meta description for SEO
document.title = "DentCare - Sistema de Gerenciamento Odontológico";
const metaDesc = document.createElement('meta');
metaDesc.name = "description";
metaDesc.content = "Sistema de gerenciamento odontológico com agendamento, prontuário digital, odontograma e integração com automações.";
document.head.appendChild(metaDesc);

// Add open graph tags
const ogTitle = document.createElement('meta');
ogTitle.property = "og:title";
ogTitle.content = "DentCare - Sistema de Gerenciamento Odontológico";
document.head.appendChild(ogTitle);

const ogDesc = document.createElement('meta');
ogDesc.property = "og:description";
ogDesc.content = "Gerencie sua clínica odontológica com agenda, prontuário digital e automações.";
document.head.appendChild(ogDesc);

const ogType = document.createElement('meta');
ogType.property = "og:type";
ogType.content = "website";
document.head.appendChild(ogType);

// Obtenha o tema do local storage ou use o tema claro como padrão
const savedTheme = localStorage.getItem('theme') || 'light';

// Aplique a classe 'dark' ao elemento raiz se o tema salvo for escuro
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme={savedTheme as 'light' | 'dark' | 'system'} enableSystem>
    <App />
  </ThemeProvider>
);
