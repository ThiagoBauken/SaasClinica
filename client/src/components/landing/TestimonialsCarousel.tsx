import { motion } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Star } from "lucide-react";

interface Testimonial {
  name: string;
  role: string;
  initials: string;
  quote: string;
  rating: number;
}

// TODO: substituir por depoimentos reais quando os tivermos.
// Estes são placeholders ilustrativos com casos plausíveis.
const TESTIMONIALS: Testimonial[] = [
  {
    name: "Dra. Beatriz Almeida",
    role: "Clínica Sorriso Pleno — São Paulo, SP",
    initials: "BA",
    quote:
      "A IA no WhatsApp é o que mais me impressionou. Ela confirma 80% das consultas sozinha durante a noite, quando eu estaria dormindo. Reduziu meu no-show de 22% para 8% em 3 meses.",
    rating: 5,
  },
  {
    name: "Dr. Rafael Mendes",
    role: "Odontoclínica Mendes — Belo Horizonte, MG",
    initials: "RM",
    quote:
      "Migrei de planilha para o DentCare em uma tarde. A digitalização dos prontuários antigos por OCR foi mágica — não precisei digitar nada. O odontograma é o melhor que já usei.",
    rating: 5,
  },
  {
    name: "Camila Ferreira",
    role: "Gerente — Rede Dental Plus (8 unidades)",
    initials: "CF",
    quote:
      "Comparei 5 sistemas. O DentCare foi o único que entregou multi-clínica sem complicação e com um financeiro de verdade. O CRM Kanban com IA puxando leads sozinho mudou nosso comercial.",
    rating: 5,
  },
];

export function TestimonialsCarousel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
    >
      <Carousel
        opts={{ align: "start", loop: true }}
        className="max-w-5xl mx-auto"
      >
        <CarouselContent>
          {TESTIMONIALS.map((t, i) => (
            <CarouselItem key={i} className="md:basis-1/2 lg:basis-1/3">
              <div className="h-full p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-6">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center text-sm font-semibold">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
    </motion.div>
  );
}
