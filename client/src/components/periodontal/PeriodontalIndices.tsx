import React from 'react';
import { Card } from '@/components/ui/card';
import { Activity, Droplets } from 'lucide-react';

interface PeriodontalIndicesProps {
  plaqueIndex: number;
  bleedingIndex: number;
}

export function PeriodontalIndices({ plaqueIndex, bleedingIndex }: PeriodontalIndicesProps) {
  const getPlaqueColor = (index: number) => {
    if (index >= 70) return 'text-red-600';
    if (index >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getBleedingColor = (index: number) => {
    if (index >= 50) return 'text-red-600';
    if (index >= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getPlaqueLevel = (index: number) => {
    if (index >= 70) return 'Ruim';
    if (index >= 40) return 'Regular';
    if (index >= 10) return 'Bom';
    return 'Excelente';
  };

  const getBleedingLevel = (index: number) => {
    if (index >= 50) return 'Severo';
    if (index >= 25) return 'Moderado';
    if (index >= 10) return 'Leve';
    return 'Saudável';
  };

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">Índices Periodontais</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Índice de Placa */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-600 mb-1">Índice de Placa</div>
            <div className={`text-3xl font-bold ${getPlaqueColor(plaqueIndex)}`}>
              {plaqueIndex.toFixed(1)}%
            </div>
            <div className="text-sm mt-1">
              <span className="font-medium">Classificação:</span>{' '}
              <span className={getPlaqueColor(plaqueIndex)}>
                {getPlaqueLevel(plaqueIndex)}
              </span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Percentual de dentes com placa bacteriana visível
            </div>
          </div>
        </div>

        {/* Índice de Sangramento */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <Droplets className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-600 mb-1">Índice de Sangramento</div>
            <div className={`text-3xl font-bold ${getBleedingColor(bleedingIndex)}`}>
              {bleedingIndex.toFixed(1)}%
            </div>
            <div className="text-sm mt-1">
              <span className="font-medium">Classificação:</span>{' '}
              <span className={getBleedingColor(bleedingIndex)}>
                {getBleedingLevel(bleedingIndex)}
              </span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Percentual de sítios com sangramento à sondagem
            </div>
          </div>
        </div>
      </div>

      {/* Barras de progresso */}
      <div className="mt-6 space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Índice de Placa</span>
            <span>{plaqueIndex.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                plaqueIndex >= 70
                  ? 'bg-red-600'
                  : plaqueIndex >= 40
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, plaqueIndex)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Índice de Sangramento</span>
            <span>{bleedingIndex.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                bleedingIndex >= 50
                  ? 'bg-red-600'
                  : bleedingIndex >= 25
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, bleedingIndex)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interpretação */}
      <div className="mt-6 p-3 bg-gray-50 rounded-lg text-sm">
        <div className="font-semibold mb-2">Interpretação:</div>
        <div className="space-y-1 text-xs">
          <div>
            <strong>Índice de Placa:</strong>{' '}
            {plaqueIndex < 10 && 'Excelente higiene oral. Manter os cuidados atuais.'}
            {plaqueIndex >= 10 && plaqueIndex < 40 && 'Boa higiene oral. Reforçar técnicas de escovação.'}
            {plaqueIndex >= 40 && plaqueIndex < 70 && 'Higiene oral deficiente. Necessário orientação intensiva.'}
            {plaqueIndex >= 70 && 'Higiene oral muito ruim. Intervenção urgente necessária.'}
          </div>
          <div>
            <strong>Índice de Sangramento:</strong>{' '}
            {bleedingIndex < 10 && 'Tecido gengival saudável.'}
            {bleedingIndex >= 10 && bleedingIndex < 25 && 'Inflamação leve. Melhorar higiene.'}
            {bleedingIndex >= 25 && bleedingIndex < 50 && 'Gengivite moderada. Tratamento recomendado.'}
            {bleedingIndex >= 50 && 'Gengivite severa ou periodontite. Tratamento urgente.'}
          </div>
        </div>
      </div>
    </Card>
  );
}
