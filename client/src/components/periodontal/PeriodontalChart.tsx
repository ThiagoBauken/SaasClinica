import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PeriodontalGrid } from './PeriodontalGrid';
import { PeriodontalIndices } from './PeriodontalIndices';
import type { PeriodontalToothData } from '@shared/schema';
import { Save, Calendar, FileText } from 'lucide-react';

interface PeriodontalChartProps {
  patientId: number;
  chartId?: number;
  readOnly?: boolean;
  onSaved?: () => void;
}

export function PeriodontalChart({
  patientId,
  chartId,
  readOnly = false,
  onSaved
}: PeriodontalChartProps) {
  const [teethData, setTeethData] = useState<PeriodontalToothData[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [chartDate, setChartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (chartId) {
      loadChart(chartId);
    } else {
      initializeEmptyChart();
    }
  }, [chartId]);

  const initializeEmptyChart = () => {
    const initialTeeth: PeriodontalToothData[] = [];

    // Quadrante 1 (superior direito): 18 a 11
    for (let i = 18; i >= 11; i--) {
      initialTeeth.push(createEmptyTooth(`${i}`));
    }
    // Quadrante 2 (superior esquerdo): 21 a 28
    for (let i = 21; i <= 28; i++) {
      initialTeeth.push(createEmptyTooth(`${i}`));
    }
    // Quadrante 3 (inferior esquerdo): 31 a 38
    for (let i = 38; i >= 31; i--) {
      initialTeeth.push(createEmptyTooth(`${i}`));
    }
    // Quadrante 4 (inferior direito): 41 a 48
    for (let i = 48; i >= 41; i--) {
      initialTeeth.push(createEmptyTooth(`${i}`));
    }

    setTeethData(initialTeeth);
  };

  const createEmptyTooth = (toothNumber: string): PeriodontalToothData => ({
    toothNumber,
    probingDepth: {
      mesialBuccal: 0,
      buccal: 0,
      distalBuccal: 0,
      mesialLingual: 0,
      lingual: 0,
      distalLingual: 0
    },
    gingivalRecession: {
      mesialBuccal: 0,
      buccal: 0,
      distalBuccal: 0,
      mesialLingual: 0,
      lingual: 0,
      distalLingual: 0
    },
    bleeding: {
      mesialBuccal: false,
      buccal: false,
      distalBuccal: false,
      mesialLingual: false,
      lingual: false,
      distalLingual: false
    },
    suppuration: {
      mesialBuccal: false,
      buccal: false,
      distalBuccal: false,
      mesialLingual: false,
      lingual: false,
      distalLingual: false
    },
    mobility: 0,
    furcation: 0,
    plaque: false,
    calculus: false,
    notes: ''
  });

  const loadChart = async (id: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/patients/${patientId}/periodontal-charts/${id}`
      );

      if (response.ok) {
        const chart = await response.json();
        setTeethData(chart.teethData || []);
        setGeneralNotes(chart.generalNotes || '');
        setDiagnosis(chart.diagnosis || '');
        setTreatmentPlan(chart.treatmentPlan || '');
        setChartDate(chart.chartDate ? new Date(chart.chartDate).toISOString().split('T')[0] : '');
      } else {
        console.error('Failed to load periodontal chart');
      }
    } catch (error) {
      console.error('Error loading periodontal chart:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = chartId
        ? `/api/v1/patients/${patientId}/periodontal-charts/${chartId}`
        : `/api/v1/patients/${patientId}/periodontal-charts`;

      const method = chartId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          teethData,
          generalNotes,
          diagnosis,
          treatmentPlan,
          plaqueIndex: calculatePlaqueIndex(),
          bleedingIndex: calculateBleedingIndex(),
          chartDate
        })
      });

      if (response.ok) {
        alert('Periodontograma salvo com sucesso!');
        onSaved?.();
      } else {
        const error = await response.json();
        alert(`Erro ao salvar: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving periodontal chart:', error);
      alert('Erro ao salvar periodontograma');
    } finally {
      setSaving(false);
    }
  };

  const calculatePlaqueIndex = (): number => {
    if (teethData.length === 0) return 0;
    const teethWithPlaque = teethData.filter(t => t.plaque).length;
    return Math.round((teethWithPlaque / teethData.length) * 100 * 100) / 100;
  };

  const calculateBleedingIndex = (): number => {
    let totalSites = 0;
    let bleedingSites = 0;

    teethData.forEach(tooth => {
      Object.values(tooth.bleeding).forEach((bleeds: boolean) => {
        totalSites++;
        if (bleeds) bleedingSites++;
      });
    });

    return totalSites > 0 ? Math.round((bleedingSites / totalSites) * 100 * 100) / 100 : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando periodontograma...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Periodontograma
          </h2>
          {!readOnly && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <input
                  type="date"
                  value={chartDate}
                  onChange={(e) => setChartDate(e.target.value)}
                  className="border rounded px-2 py-1"
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          )}
        </div>

        {/* Grid principal com os dentes */}
        <PeriodontalGrid
          teethData={teethData}
          onChange={setTeethData}
          readOnly={readOnly}
        />

        {/* Índices periodontais */}
        <div className="mt-6">
          <PeriodontalIndices
            plaqueIndex={calculatePlaqueIndex()}
            bleedingIndex={calculateBleedingIndex()}
          />
        </div>

        {/* Observações */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Observações Gerais
            </label>
            <Textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Observações sobre o exame periodontal..."
              disabled={readOnly}
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Diagnóstico
            </label>
            <Textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Diagnóstico periodontal..."
              disabled={readOnly}
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Plano de Tratamento
            </label>
            <Textarea
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              placeholder="Plano de tratamento periodontal..."
              disabled={readOnly}
              rows={4}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
