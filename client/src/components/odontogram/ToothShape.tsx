import React from "react";
import { ToothGroup, ToothPosition, ToothType } from "@/lib/types";

interface ToothShapeProps {
  group: ToothGroup;
  position: ToothPosition;
  type: ToothType;
  selected?: boolean;
  onClick?: () => void;
  status?: string;
}

export function ToothShape({ 
  group, 
  position, 
  type, 
  selected = false, 
  onClick, 
  status = 'saudavel' 
}: ToothShapeProps) {
  
  // Determina qual SVG exibir com base no grupo e tipo
  const renderToothShape = () => {
    // Aplicar cores com base no status
    let fillColor = "#ffffff";
    let strokeColor = "#cccccc";
    let rootFill = "#ffffff";
    
    if (selected) {
      strokeColor = "#4f46e5";
    }
    
    switch (status) {
      case 'cariado':
        fillColor = "#ffcccc";
        break;
      case 'restaurado':
        fillColor = "#cceeff";
        break;
      case 'ausente':
        fillColor = "#eeeeee";
        strokeColor = "#aaaaaa";
        break;
      case 'implante':
        rootFill = "#e6e6e6";
        break;
      case 'tratamento-canal':
        rootFill = "#ffe0cc";
        break;
      case 'coroa':
        fillColor = "#d8f7c8";
        break;
      case 'extrair':
        fillColor = "#ffdddd";
        strokeColor = "#ff6666";
        break;
      case 'protese':
        fillColor = "#e0eaff";
        break;
      default:
        break;
    }
    
    // Renderização com base no grupo do dente
    switch (group) {
      case 'incisivo':
        return (
          <svg viewBox="0 0 40 80" width="40" height="80">
            {/* Raiz do dente (simplificada) */}
            {position === 'superior' ? (
              <path 
                d="M20,30 L15,75 L25,75 L20,30" 
                fill={rootFill} 
                stroke={strokeColor} 
                strokeWidth="1" 
              />
            ) : (
              <path 
                d="M20,30 L15,5 L25,5 L20,30" 
                fill={rootFill} 
                stroke={strokeColor} 
                strokeWidth="1" 
              />
            )}
            
            {/* Coroa do incisivo */}
            <rect 
              x="12" 
              y="10" 
              width="16" 
              height="20" 
              rx="2"
              fill={fillColor} 
              stroke={strokeColor} 
              strokeWidth="1"
            />
            <line 
              x1="12" 
              y1="10" 
              x2="28" 
              y2="10" 
              stroke={strokeColor} 
              strokeWidth="1"
            />
          </svg>
        );
        
      case 'canino':
        return (
          <svg viewBox="0 0 40 80" width="40" height="80">
            {/* Raiz do dente (mais longa para caninos) */}
            {position === 'superior' ? (
              <path 
                d="M20,34 L15,75 L25,75 L20,34" 
                fill={rootFill} 
                stroke={strokeColor} 
                strokeWidth="1" 
              />
            ) : (
              <path 
                d="M20,34 L15,5 L25,5 L20,34" 
                fill={rootFill} 
                stroke={strokeColor} 
                strokeWidth="1" 
              />
            )}
            
            {/* Coroa do canino (mais pontiaguda) */}
            <path 
              d="M12,34 L20,10 L28,34 Z" 
              fill={fillColor} 
              stroke={strokeColor} 
              strokeWidth="1"
            />
          </svg>
        );
        
      case 'premolar':
        return (
          <svg viewBox="0 0 40 80" width="40" height="80">
            {/* Raízes do pré-molar (geralmente duas) */}
            {position === 'superior' ? (
              <g>
                <path 
                  d="M15,30 L12,75 L18,75 L15,30" 
                  fill={rootFill} 
                  stroke={strokeColor} 
                  strokeWidth="1" 
                />
                <path 
                  d="M25,30 L22,75 L28,75 L25,30" 
                  fill={rootFill} 
                  stroke={strokeColor} 
                  strokeWidth="1" 
                />
              </g>
            ) : (
              <g>
                <path 
                  d="M15,30 L12,5 L18,5 L15,30" 
                  fill={rootFill} 
                  stroke={strokeColor} 
                  strokeWidth="1" 
                />
                <path 
                  d="M25,30 L22,5 L28,5 L25,30" 
                  fill={rootFill} 
                  stroke={strokeColor} 
                  strokeWidth="1" 
                />
              </g>
            )}
            
            {/* Coroa do pré-molar (oval com sulco) */}
            <ellipse 
              cx="20" 
              cy="20" 
              rx="12" 
              ry="10" 
              fill={fillColor} 
              stroke={strokeColor} 
              strokeWidth="1"
            />
            <line 
              x1="14" 
              y1="20" 
              x2="26" 
              y2="20" 
              stroke={strokeColor} 
              strokeWidth="1"
            />
          </svg>
        );
        
      case 'molar':
        return (
          <svg viewBox="0 0 50 80" width="50" height="80">
            {/* Raízes do molar (geralmente três) */}
            {position === 'superior' ? (
              <g>
                <path 
                  d="M15,35 L10,75 L20,75 L15,35" 
                  fill={rootFill} 
                  stroke={strokeColor} 
                  strokeWidth="1" 
                />
                <path 
                  d="M25,35 L20,75 L30,75 L25,35" 
                  fill={rootFill} 
                  stroke={strokeColor} 
                  strokeWidth="1" 
                />
                <path 
                  d="M35,35 L30,75 L40,75 L35,35" 
                  fill={rootFill} 
                  stroke={strokeColor} 
                  strokeWidth="1" 
                />
              </g>
            ) : (
              <g>
                <path 
                  d="M15,35 L10,5 L20,5 L15,35" 
                  fill={rootFill} 
                  stroke={strokeColor} 
                  strokeWidth="1" 
                />
                <path 
                  d="M35,35 L30,5 L40,5 L35,35" 
                  fill={rootFill} 
                  stroke={strokeColor} 
                  strokeWidth="1" 
                />
              </g>
            )}
            
            {/* Coroa do molar (retangular com sulcos) */}
            <rect 
              x="10" 
              y="10" 
              width="30" 
              height="25" 
              rx="4"
              fill={fillColor} 
              stroke={strokeColor} 
              strokeWidth="1"
            />
            <line 
              x1="18" 
              y1="16" 
              x2="32" 
              y2="16" 
              stroke={strokeColor} 
              strokeWidth="1"
            />
            <line 
              x1="18" 
              y1="22" 
              x2="32" 
              y2="22" 
              stroke={strokeColor} 
              strokeWidth="1"
            />
            <line 
              x1="25" 
              y1="14" 
              x2="25" 
              y2="28" 
              stroke={strokeColor} 
              strokeWidth="1"
            />
          </svg>
        );
        
      default:
        // Forma padrão em caso de erro
        return (
          <svg viewBox="0 0 40 40" width="40" height="40">
            <circle 
              cx="20" 
              cy="20" 
              r="18" 
              fill={fillColor} 
              stroke={strokeColor} 
              strokeWidth="1"
            />
          </svg>
        );
    }
  };

  return (
    <div 
      className={`cursor-pointer hover:scale-105 transition-transform ${selected ? 'ring-2 ring-primary rounded-md' : ''}`}
      onClick={onClick}
    >
      {renderToothShape()}
    </div>
  );
}