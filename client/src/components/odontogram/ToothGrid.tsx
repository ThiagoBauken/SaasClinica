import React from "react";
import { cn } from "@/lib/utils";
import { ToothSide } from "@/lib/types";

interface ToothGridProps {
  selectedSides: ToothSide[];
  onSideClick: (side: ToothSide) => void;
  status?: string;
}

export default function ToothGrid({ selectedSides, onSideClick, status = 'saudavel' }: ToothGridProps) {
  // Determinar cores com base no status e se está selecionado
  const getColor = (side: ToothSide) => {
    if (selectedSides.includes(side)) {
      switch (status) {
        case 'cariado': return "bg-red-500";
        case 'restaurado': return "bg-blue-400";
        case 'ausente': return "bg-gray-400";
        case 'implante': return "bg-gray-500";
        case 'tratamento-canal': return "bg-blue-500";
        case 'coroa': return "bg-yellow-400";
        case 'extrair': return "bg-red-600";
        case 'protese': return "bg-purple-400";
        default: return "bg-yellow-400";
      }
    }
    return "bg-white";
  };

  return (
    <div className="w-[25px] h-[25px] border border-gray-300 relative">
      {/* Área central */}
      <div 
        className={cn(
          "absolute inset-[5px] border border-gray-300 cursor-pointer hover:bg-gray-100",
          getColor("oclusal")
        )} 
        onClick={() => onSideClick("oclusal")}
      />

      {/* Área superior (vestibular) */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 h-[5px] border-b border-r border-l border-gray-300 cursor-pointer hover:bg-gray-100",
          getColor("vestibular")
        )} 
        onClick={() => onSideClick("vestibular")}
      />

      {/* Área inferior (lingual) */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 h-[5px] border-t border-r border-l border-gray-300 cursor-pointer hover:bg-gray-100",
          getColor("lingual")
        )} 
        onClick={() => onSideClick("lingual")}
      />

      {/* Área esquerda (mesial) */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[5px] border-r border-t border-b border-gray-300 cursor-pointer hover:bg-gray-100",
          getColor("mesial")
        )} 
        onClick={() => onSideClick("mesial")}
      />

      {/* Área direita (distal) */}
      <div 
        className={cn(
          "absolute right-0 top-0 bottom-0 w-[5px] border-l border-t border-b border-gray-300 cursor-pointer hover:bg-gray-100",
          getColor("distal")
        )} 
        onClick={() => onSideClick("distal")}
      />
    </div>
  );
}