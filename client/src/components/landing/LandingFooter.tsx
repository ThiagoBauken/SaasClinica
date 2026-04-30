import { Link } from "wouter";

export function LandingFooter() {
  return (
    <footer className="bg-slate-950 text-slate-300 py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2 text-2xl font-bold text-white mb-4">
              <span className="text-3xl">🦷</span>
              <span>DentCare</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              A plataforma completa para clínicas odontológicas modernas.
              Agenda, prontuário, financeiro e atendimento com IA — em um só lugar.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Produto</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#recursos" className="hover:text-white transition-colors">Recursos</a></li>
              <li><a href="#ia" className="hover:text-white transition-colors">IA & WhatsApp</a></li>
              <li><Link href="/precos"><span className="hover:text-white transition-colors cursor-pointer">Planos e preços</span></Link></li>
              <li><a href="#faq" className="hover:text-white transition-colors">Perguntas frequentes</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/termos-de-uso"><span className="hover:text-white transition-colors cursor-pointer">Termos de Uso</span></Link></li>
              <li><Link href="/politica-de-privacidade"><span className="hover:text-white transition-colors cursor-pointer">Política de Privacidade</span></Link></li>
              <li><Link href="/lgpd"><span className="hover:text-white transition-colors cursor-pointer">LGPD</span></Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Contato</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>contato@dentcare.com.br</li>
              <li>São Paulo, SP — Brasil</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} DentCare. Todos os direitos reservados.</p>
          <p className="text-xs">Feito com IA Claude • LGPD compliant • Dados criptografados</p>
        </div>
      </div>
    </footer>
  );
}
