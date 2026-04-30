import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
  index?: number;
}

export function FeatureCard({ icon, title, description, highlight = false, index = 0 }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.06, 0.4) }}
      whileHover={{ y: -4 }}
      className={`relative p-6 rounded-2xl border bg-white transition-shadow ${
        highlight
          ? "border-blue-200 shadow-lg shadow-blue-100 ring-1 ring-blue-100"
          : "border-slate-200 hover:shadow-md"
      }`}
    >
      {highlight && (
        <span className="absolute -top-2 right-4 text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase">
          Destaque
        </span>
      )}
      <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${
        highlight ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
      }`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}
