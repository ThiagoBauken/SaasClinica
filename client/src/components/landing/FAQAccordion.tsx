import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="max-w-3xl mx-auto"
    >
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-slate-200">
            <AccordionTrigger className="text-left text-base font-medium text-slate-900 hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-slate-600 leading-relaxed">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.div>
  );
}
