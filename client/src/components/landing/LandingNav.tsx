import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/core/AuthProvider";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LandingNavProps {
  showAnchors?: boolean;
}

export function LandingNav({ showAnchors = true }: LandingNavProps) {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm"
          : "bg-transparent"
      )}
    >
      <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/landing">
          <a className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <span className="text-2xl">🦷</span>
            <span>DentCare</span>
          </a>
        </Link>

        {showAnchors && (
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-700">
            <a href="#recursos" className="hover:text-blue-600 transition-colors">Recursos</a>
            <a href="#ia" className="hover:text-blue-600 transition-colors">IA</a>
            <Link href="/precos"><span className="hover:text-blue-600 transition-colors cursor-pointer">Planos</span></Link>
            <a href="#faq" className="hover:text-blue-600 transition-colors">FAQ</a>
          </div>
        )}

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link href="/dashboard">
              <Button variant="default">Acessar Sistema</Button>
            </Link>
          ) : (
            <>
              <Link href="/auth">
                <Button variant="ghost" className="text-slate-700">Entrar</Button>
              </Link>
              <Link href="/auth">
                <Button className="bg-blue-600 hover:bg-blue-700">Testar grátis</Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 text-slate-700"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3">
          {showAnchors && (
            <>
              <a href="#recursos" className="block py-2 text-slate-700" onClick={() => setMobileOpen(false)}>Recursos</a>
              <a href="#ia" className="block py-2 text-slate-700" onClick={() => setMobileOpen(false)}>IA</a>
              <Link href="/precos"><a className="block py-2 text-slate-700" onClick={() => setMobileOpen(false)}>Planos</a></Link>
              <a href="#faq" className="block py-2 text-slate-700" onClick={() => setMobileOpen(false)}>FAQ</a>
            </>
          )}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            {user ? (
              <Link href="/dashboard">
                <Button className="w-full">Acessar Sistema</Button>
              </Link>
            ) : (
              <>
                <Link href="/auth">
                  <Button variant="outline" className="w-full">Entrar</Button>
                </Link>
                <Link href="/auth">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">Testar grátis</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
