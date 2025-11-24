import React from 'react';
import { ToothPeriodontalInput } from './ToothPeriodontalInput';
import type { PeriodontalToothData } from '@shared/schema';

interface PeriodontalGridProps {
  teethData: PeriodontalToothData[];
  onChange: (teethData: PeriodontalToothData[]) => void;
  readOnly?: boolean;
}

export function PeriodontalGrid({ teethData, onChange, readOnly = false }: PeriodontalGridProps) {
  const handleToothChange = (toothNumber: string, updatedTooth: PeriodontalToothData) => {
    const newTeethData = teethData.map(tooth =>
      tooth.toothNumber === toothNumber ? updatedTooth : tooth
    );
    onChange(newTeethData);
  };

  // Dividir dentes por quadrante
  const upperRightTeeth = teethData.filter(t => {
    const num = parseInt(t.toothNumber);
    return num >= 11 && num <= 18;
  });

  const upperLeftTeeth = teethData.filter(t => {
    const num = parseInt(t.toothNumber);
    return num >= 21 && num <= 28;
  });

  const lowerLeftTeeth = teethData.filter(t => {
    const num = parseInt(t.toothNumber);
    return num >= 31 && num <= 38;
  });

  const lowerRightTeeth = teethData.filter(t => {
    const num = parseInt(t.toothNumber);
    return num >= 41 && num <= 48;
  });

  return (
    <div className="space-y-8">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Periodontograma Completo - 32 Dentes</h3>
        <p className="text-sm text-gray-600">
          Profundidade de Sondagem (mm) | Recessão Gengival (mm) | Sangramento | Mobilidade
        </p>
      </div>

      {/* Arcada Superior */}
      <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
        <div className="text-center mb-2">
          <span className="text-sm font-semibold text-gray-700">ARCADA SUPERIOR</span>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Quadrante 1 - Superior Direito */}
          <div className="border-r-2 border-gray-300 pr-4">
            <div className="text-center mb-2">
              <span className="text-xs font-medium text-gray-600">Q1 - Superior Direito</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {upperRightTeeth.sort((a, b) => parseInt(b.toothNumber) - parseInt(a.toothNumber)).map(tooth => (
                <ToothPeriodontalInput
                  key={tooth.toothNumber}
                  tooth={tooth}
                  onChange={(updated) => handleToothChange(tooth.toothNumber, updated)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>

          {/* Quadrante 2 - Superior Esquerdo */}
          <div className="pl-4">
            <div className="text-center mb-2">
              <span className="text-xs font-medium text-gray-600">Q2 - Superior Esquerdo</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {upperLeftTeeth.sort((a, b) => parseInt(a.toothNumber) - parseInt(b.toothNumber)).map(tooth => (
                <ToothPeriodontalInput
                  key={tooth.toothNumber}
                  tooth={tooth}
                  onChange={(updated) => handleToothChange(tooth.toothNumber, updated)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Linha divisória arcadas */}
      <div className="border-t-4 border-blue-500 relative">
        <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-4 text-xs font-bold text-blue-600">
          LINHA DE OCLUSÃO
        </span>
      </div>

      {/* Arcada Inferior */}
      <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
        <div className="text-center mb-2">
          <span className="text-sm font-semibold text-gray-700">ARCADA INFERIOR</span>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Quadrante 4 - Inferior Direito */}
          <div className="border-r-2 border-gray-300 pr-4">
            <div className="text-center mb-2">
              <span className="text-xs font-medium text-gray-600">Q4 - Inferior Direito</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {lowerRightTeeth.sort((a, b) => parseInt(b.toothNumber) - parseInt(a.toothNumber)).map(tooth => (
                <ToothPeriodontalInput
                  key={tooth.toothNumber}
                  tooth={tooth}
                  onChange={(updated) => handleToothChange(tooth.toothNumber, updated)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>

          {/* Quadrante 3 - Inferior Esquerdo */}
          <div className="pl-4">
            <div className="text-center mb-2">
              <span className="text-xs font-medium text-gray-600">Q3 - Inferior Esquerdo</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {lowerLeftTeeth.sort((a, b) => parseInt(a.toothNumber) - parseInt(b.toothNumber)).map(tooth => (
                <ToothPeriodontalInput
                  key={tooth.toothNumber}
                  tooth={tooth}
                  onChange={(updated) => handleToothChange(tooth.toothNumber, updated)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-semibold mb-2">Legenda:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="font-medium">Profundidade:</span> 0-3mm (normal), 4-5mm (moderado), ≥6mm (severo)
          </div>
          <div>
            <span className="font-medium">Mobilidade:</span> 0=normal, 1=leve, 2=moderada, 3=severa
          </div>
          <div>
            <span className="font-medium">Furca:</span> 0=sem, 1=incipiente, 2=moderada, 3=severa
          </div>
          <div>
            <span className="font-medium">Cores:</span>
            <span className="ml-1 text-red-600">Vermelho=sangramento</span>
          </div>
        </div>
      </div>
    </div>
  );
}
