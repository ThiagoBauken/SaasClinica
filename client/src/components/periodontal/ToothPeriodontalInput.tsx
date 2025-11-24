import React, { useState } from 'react';
import type { PeriodontalToothData } from '@shared/schema';
import { AlertCircle, Droplet } from 'lucide-react';

interface ToothPeriodontalInputProps {
  tooth: PeriodontalToothData;
  onChange: (tooth: PeriodontalToothData) => void;
  readOnly?: boolean;
}

export function ToothPeriodontalInput({
  tooth,
  onChange,
  readOnly = false
}: ToothPeriodontalInputProps) {
  const [expanded, setExpanded] = useState(false);

  const handleProbingDepthChange = (position: keyof typeof tooth.probingDepth, value: number) => {
    onChange({
      ...tooth,
      probingDepth: {
        ...tooth.probingDepth,
        [position]: Math.max(0, Math.min(15, value)) // Limit 0-15mm
      }
    });
  };

  const handleBleedingToggle = (position: keyof typeof tooth.bleeding) => {
    onChange({
      ...tooth,
      bleeding: {
        ...tooth.bleeding,
        [position]: !tooth.bleeding[position]
      }
    });
  };

  const handleMobilityChange = (value: 0 | 1 | 2 | 3) => {
    onChange({ ...tooth, mobility: value });
  };

  // Calcular máxima profundidade de sondagem
  const maxProbingDepth = Math.max(...Object.values(tooth.probingDepth));

  // Determinar cor baseada na profundidade
  const getColor = () => {
    if (maxProbingDepth >= 6) return 'bg-red-100 border-red-500';
    if (maxProbingDepth >= 4) return 'bg-yellow-100 border-yellow-500';
    return 'bg-green-50 border-green-300';
  };

  // Verificar se há sangramento
  const hasBleeding = Object.values(tooth.bleeding).some(b => b);

  return (
    <div className="relative">
      <div
        className={`border-2 rounded-lg p-2 cursor-pointer transition-all ${getColor()} ${
          expanded ? 'ring-2 ring-blue-400' : ''
        }`}
        onClick={() => !readOnly && setExpanded(!expanded)}
      >
        {/* Número do dente */}
        <div className="text-center font-bold text-sm mb-1">{tooth.toothNumber}</div>

        {/* Indicadores visuais */}
        <div className="flex justify-center gap-1 mb-1">
          {hasBleeding && (
            <Droplet className="h-3 w-3 text-red-600" fill="currentColor" />
          )}
          {tooth.mobility > 0 && (
            <AlertCircle className="h-3 w-3 text-orange-600" />
          )}
        </div>

        {/* Profundidade máxima */}
        <div className="text-center text-xs font-semibold">
          {maxProbingDepth > 0 ? `${maxProbingDepth}mm` : '-'}
        </div>

        {/* Mobilidade */}
        {tooth.mobility > 0 && (
          <div className="text-center text-xs text-orange-700">
            M: {tooth.mobility}
          </div>
        )}
      </div>

      {/* Modal expandido para entrada detalhada */}
      {expanded && !readOnly && (
        <div className="absolute z-50 mt-2 bg-white border-2 border-blue-400 rounded-lg shadow-xl p-4 w-80"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold">Dente {tooth.toothNumber}</h4>
              <button
                onClick={() => setExpanded(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Profundidade de Sondagem */}
          <div className="mb-3">
            <div className="text-sm font-semibold mb-1">Profundidade de Sondagem (mm)</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label>Mesial V:</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={tooth.probingDepth.mesialBuccal}
                  onChange={(e) => handleProbingDepthChange('mesialBuccal', parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-1 py-0.5"
                />
              </div>
              <div>
                <label>Vestibular:</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={tooth.probingDepth.buccal}
                  onChange={(e) => handleProbingDepthChange('buccal', parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-1 py-0.5"
                />
              </div>
              <div>
                <label>Distal V:</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={tooth.probingDepth.distalBuccal}
                  onChange={(e) => handleProbingDepthChange('distalBuccal', parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-1 py-0.5"
                />
              </div>
              <div>
                <label>Mesial L:</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={tooth.probingDepth.mesialLingual}
                  onChange={(e) => handleProbingDepthChange('mesialLingual', parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-1 py-0.5"
                />
              </div>
              <div>
                <label>Lingual:</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={tooth.probingDepth.lingual}
                  onChange={(e) => handleProbingDepthChange('lingual', parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-1 py-0.5"
                />
              </div>
              <div>
                <label>Distal L:</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={tooth.probingDepth.distalLingual}
                  onChange={(e) => handleProbingDepthChange('distalLingual', parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-1 py-0.5"
                />
              </div>
            </div>
          </div>

          {/* Sangramento */}
          <div className="mb-3">
            <div className="text-sm font-semibold mb-1">Sangramento à Sondagem</div>
            <div className="grid grid-cols-6 gap-1 text-xs">
              {(['mesialBuccal', 'buccal', 'distalBuccal', 'mesialLingual', 'lingual', 'distalLingual'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => handleBleedingToggle(pos)}
                  className={`p-1 rounded ${
                    tooth.bleeding[pos]
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  {pos.substring(0, 1).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Mobilidade e Furca */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-sm font-semibold">Mobilidade:</label>
              <select
                value={tooth.mobility}
                onChange={(e) => handleMobilityChange(parseInt(e.target.value) as 0 | 1 | 2 | 3)}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value={0}>0 - Normal</option>
                <option value={1}>1 - Leve</option>
                <option value={2}>2 - Moderada</option>
                <option value={3}>3 - Severa</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Furca:</label>
              <select
                value={tooth.furcation}
                onChange={(e) => onChange({ ...tooth, furcation: parseInt(e.target.value) as 0 | 1 | 2 | 3 })}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value={0}>0 - Sem lesão</option>
                <option value={1}>1 - Incipiente</option>
                <option value={2}>2 - Moderada</option>
                <option value={3}>3 - Severa</option>
              </select>
            </div>
          </div>

          {/* Placa e Cálculo */}
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={tooth.plaque}
                onChange={(e) => onChange({ ...tooth, plaque: e.target.checked })}
                className="rounded"
              />
              Placa
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={tooth.calculus}
                onChange={(e) => onChange({ ...tooth, calculus: e.target.checked })}
                className="rounded"
              />
              Cálculo
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
