import React from "react";
import { ToothGroup, ToothPosition, ToothSide, ToothType } from "@/lib/types";

interface ToothShapeProps {
  number: string;
  group: ToothGroup;
  position: ToothPosition;
  type: ToothType;
  selected?: boolean;
  onClick?: () => void;
  status?: string;
  highlightedSides?: ToothSide[];
}

export function ToothShape({ 
  number,
  group, 
  position, 
  type, 
  selected = false, 
  onClick, 
  status = 'saudavel',
  highlightedSides = []
}: ToothShapeProps) {
  
  // Determina qual cor aplicar com base no status
  const getStatusColor = () => {
    switch (status) {
      case 'cariado':
        return "#f87171"; // Vermelho para cáries
      case 'restaurado':
        return "#93c5fd"; // Azul para restaurações
      case 'ausente':
        return "#e5e5e5"; // Cinza claro para ausentes
      case 'implante':
        return "#d1d5db"; // Cinza para implantes
      case 'tratamento-canal':
        return "#60a5fa"; // Azul mais forte para tratamento de canal
      case 'coroa':
        return "#fcd34d"; // Amarelo para coroas
      case 'extrair':
        return "#ef4444"; // Vermelho forte para extração
      case 'protese':
        return "#a78bfa"; // Lilás para próteses
      default:
        return "#ffffff"; // Branco para dentes saudáveis
    }
  };
  
  const fillColor = getStatusColor();
  const strokeColor = selected ? "#eab308" : "#cccccc";
  const strokeWidth = selected ? 2 : 1;
  
  // Renderizar dente com estilo baseado nas imagens de referência
  if (position === 'superior') {
    return (
      <div className="flex flex-col items-center w-[30px]">
        <svg width="24" height="42" viewBox="0 0 24 42">
          {/* Raízes superiores */}
          <path 
            d="M7,15 L4,36 M12,15 L12,36 M17,15 L20,36" 
            fill="none" 
            stroke={strokeColor} 
            strokeWidth={strokeWidth} 
          />
          
          {/* Corpo do dente */}
          <rect 
            x="4" 
            y="2" 
            width="16" 
            height="13" 
            rx="2"
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth={strokeWidth} 
          />
          
          {/* Topo do dente (curvatura) */}
          <path 
            d="M4,4 Q12,-2 20,4" 
            fill="none" 
            stroke={strokeColor} 
            strokeWidth={strokeWidth} 
          />
        </svg>
      </div>
    );
  } else {
    return (
      <div className="flex flex-col items-center w-[30px]">
        <svg width="24" height="42" viewBox="0 0 24 42">
          {/* Corpo do dente */}
          <rect 
            x="4" 
            y="20" 
            width="16" 
            height="13" 
            rx="2"
            fill={fillColor} 
            stroke={strokeColor} 
            strokeWidth={strokeWidth} 
          />
          
          {/* Base do dente (curvatura) */}
          <path 
            d="M4,31 Q12,37 20,31" 
            fill="none" 
            stroke={strokeColor} 
            strokeWidth={strokeWidth} 
          />
          
          {/* Raízes inferiores */}
          <path 
            d="M7,33 L4,5 M12,33 L12,5 M17,33 L20,5" 
            fill="none" 
            stroke={strokeColor} 
            strokeWidth={strokeWidth} 
          />
        </svg>
      </div>
    );
  }
}