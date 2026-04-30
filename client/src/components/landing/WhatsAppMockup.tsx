import { motion } from "framer-motion";

interface Message {
  from: "patient" | "ai";
  text: string;
}

const CONVERSATION: Message[] = [
  { from: "patient", text: "Oi, queria marcar uma limpeza pra essa semana" },
  { from: "ai", text: "Olá! Claro 😊 Tenho horário hoje 17h ou amanhã 10h. Qual prefere?" },
  { from: "patient", text: "Amanhã 10h ta bom" },
  { from: "ai", text: "Perfeito! Agendei sua limpeza com a Dra. Beatriz amanhã às 10h. Você recebe um lembrete na noite anterior. Qualquer coisa, é só chamar 🦷" },
];

export function WhatsAppMockup() {
  return (
    <div className="relative max-w-sm mx-auto">
      <div className="absolute -inset-2 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-3xl blur-2xl opacity-30" />

      <div className="relative bg-[#075E54] rounded-3xl shadow-2xl overflow-hidden border-8 border-slate-900">
        <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 text-white">
          <div className="h-9 w-9 rounded-full bg-white text-[#075E54] flex items-center justify-center font-bold text-sm">
            🦷
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">DentCare — Clínica Sorriso</p>
            <p className="text-[11px] text-emerald-100 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
              IA online
            </p>
          </div>
        </div>

        <div className="bg-[#ECE5DD] px-3 py-4 space-y-2 min-h-[360px]">
          {CONVERSATION.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.4, duration: 0.35 }}
              className={`flex ${msg.from === "ai" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm leading-snug shadow-sm ${
                  msg.from === "ai"
                    ? "bg-white text-slate-800 rounded-tl-none"
                    : "bg-[#DCF8C6] text-slate-800 rounded-tr-none"
                }`}
              >
                {msg.text}
                <span className="block text-[9px] text-slate-400 text-right mt-0.5">
                  {msg.from === "ai" ? "10:42" : "10:41"} {msg.from === "patient" && "✓✓"}
                </span>
              </div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: CONVERSATION.length * 0.4 + 0.2 }}
            className="flex justify-center pt-2"
          >
            <span className="text-[10px] bg-white/80 text-slate-500 px-2 py-0.5 rounded-full">
              ✨ Agendamento criado automaticamente pela IA
            </span>
          </motion.div>
        </div>

        <div className="bg-[#F0F0F0] px-3 py-2 flex items-center gap-2 text-slate-400 text-xs">
          <span>😊</span>
          <span className="flex-1">Mensagem</span>
          <span>🎤</span>
        </div>
      </div>
    </div>
  );
}
