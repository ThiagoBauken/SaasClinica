import { motion } from "framer-motion";
import { Calendar, Users, DollarSign, Activity, Bell } from "lucide-react";

/**
 * Mockup visual do dashboard — não é um dashboard real, é um visual estático
 * estilizado pra hero da landing. Usa SVG/HTML/Tailwind, sem imagem externa.
 */
export function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
      className="relative w-full max-w-2xl mx-auto"
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-2xl blur-2xl opacity-30" />

      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <span className="text-xs text-slate-400 font-mono">app.dentcare.com.br/dashboard</span>
          </div>
        </div>

        <div className="flex">
          <div className="hidden sm:flex w-44 bg-slate-900 flex-col py-4 gap-1">
            <div className="px-4 py-2 flex items-center gap-2 text-white font-semibold text-sm border-l-2 border-cyan-400 bg-slate-800">
              <span className="text-base">🦷</span> DentCare
            </div>
            {[
              { icon: Activity, label: "Dashboard", active: true },
              { icon: Calendar, label: "Agenda" },
              { icon: Users, label: "Pacientes" },
              { icon: DollarSign, label: "Financeiro" },
              { icon: Bell, label: "WhatsApp IA" },
            ].map((item, i) => (
              <div
                key={i}
                className={`px-4 py-2 flex items-center gap-2 text-xs ${
                  item.active ? "text-white bg-slate-800" : "text-slate-400"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </div>
            ))}
          </div>

          <div className="flex-1 p-4 sm:p-6 bg-slate-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Olá, Dr. Rafael 👋</h3>
              <span className="text-xs text-slate-500">Hoje, 12 de novembro</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white p-3 rounded-lg border border-slate-200"
              >
                <p className="text-[10px] text-slate-500 mb-1">Consultas hoje</p>
                <p className="text-lg font-bold text-slate-900">14</p>
                <p className="text-[10px] text-emerald-600 font-medium">+3 vs ontem</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white p-3 rounded-lg border border-slate-200"
              >
                <p className="text-[10px] text-slate-500 mb-1">Confirmados IA</p>
                <p className="text-lg font-bold text-blue-600">11</p>
                <p className="text-[10px] text-slate-500">79% da agenda</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white p-3 rounded-lg border border-slate-200"
              >
                <p className="text-[10px] text-slate-500 mb-1">Receita mês</p>
                <p className="text-lg font-bold text-slate-900">R$ 38k</p>
                <p className="text-[10px] text-emerald-600 font-medium">+22%</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-white p-3 rounded-lg border border-slate-200"
              >
                <p className="text-[10px] text-slate-500 mb-1">Leads no CRM</p>
                <p className="text-lg font-bold text-slate-900">23</p>
                <p className="text-[10px] text-slate-500">8 quentes</p>
              </motion.div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-700">Próximas consultas</p>
                <span className="text-[10px] text-blue-600 font-medium">Ver agenda →</span>
              </div>
              <div className="space-y-2">
                {[
                  { time: "09:00", name: "Maria Silva", proc: "Limpeza", status: "✓" },
                  { time: "10:30", name: "João P. Lima", proc: "Restauração", status: "✓" },
                  { time: "11:00", name: "Ana Costa", proc: "Avaliação", status: "⌛" },
                ].map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + i * 0.1 }}
                    className="flex items-center gap-3 p-2 rounded bg-slate-50"
                  >
                    <span className="text-xs font-mono text-slate-500 w-10">{c.time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-500">{c.proc}</p>
                    </div>
                    <span className="text-xs">{c.status}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: -20, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="absolute -left-2 sm:-left-6 -bottom-4 bg-white p-3 rounded-xl shadow-xl border border-slate-200 max-w-[220px] hidden sm:block"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[10px] font-semibold text-slate-700">IA — WhatsApp</p>
        </div>
        <p className="text-xs text-slate-700 leading-snug">
          "Olá Maria! Confirmei sua consulta de limpeza para amanhã às 9h ✨"
        </p>
      </motion.div>
    </motion.div>
  );
}
