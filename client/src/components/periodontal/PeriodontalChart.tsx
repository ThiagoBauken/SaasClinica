import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Save, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PeriodontalToothData, PeriodontalMeasurements, PeriodontalBleedingSupp } from '@shared/schema';

// ---------------------------------------------------------------------------
// Constants — FDI tooth numbering, standard horizontal layout
// ---------------------------------------------------------------------------

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] as const;
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] as const;

const BUCCAL_SITES: (keyof PeriodontalMeasurements)[] = ['mesialBuccal', 'buccal', 'distalBuccal'];
const LINGUAL_SITES: (keyof PeriodontalMeasurements)[] = ['mesialLingual', 'lingual', 'distalLingual'];

const SITE_LABELS: Record<keyof PeriodontalMeasurements, string> = {
  mesialBuccal: 'MV',
  buccal: 'V',
  distalBuccal: 'DV',
  mesialLingual: 'ML',
  lingual: 'L',
  distalLingual: 'DL',
};

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

interface PeriodontalChartRecord {
  id: number;
  patientId: number;
  companyId: number;
  professionalId: number | null;
  chartDate: string;
  teethData: PeriodontalToothData[];
  generalNotes: string | null;
  diagnosis: string | null;
  treatmentPlan: string | null;
  plaqueIndex: string | null;
  bleedingIndex: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Internal chart state — keyed by tooth number string
// ---------------------------------------------------------------------------

type ChartMeasurements = Record<string, PeriodontalToothData>;

function buildEmptyMeasurements(): PeriodontalMeasurements {
  return {
    mesialBuccal: 0,
    buccal: 0,
    distalBuccal: 0,
    mesialLingual: 0,
    lingual: 0,
    distalLingual: 0,
  };
}

function buildEmptyBleeding(): PeriodontalBleedingSupp {
  return {
    mesialBuccal: false,
    buccal: false,
    distalBuccal: false,
    mesialLingual: false,
    lingual: false,
    distalLingual: false,
  };
}

function buildEmptyTooth(toothNumber: string): PeriodontalToothData {
  return {
    toothNumber,
    probingDepth: buildEmptyMeasurements(),
    gingivalRecession: buildEmptyMeasurements(),
    bleeding: buildEmptyBleeding(),
    suppuration: buildEmptyBleeding(),
    mobility: 0,
    furcation: 0,
    plaque: false,
    calculus: false,
  };
}

function initChart(teethData?: PeriodontalToothData[]): ChartMeasurements {
  const chart: ChartMeasurements = {};
  [...UPPER_TEETH, ...LOWER_TEETH].forEach(n => {
    chart[n.toString()] = buildEmptyTooth(n.toString());
  });
  if (teethData) {
    teethData.forEach(t => {
      chart[t.toothNumber] = t;
    });
  }
  return chart;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function getDepthColorClass(depth: number): string {
  if (depth === 0) return 'bg-gray-100 text-gray-400 border-gray-200';
  if (depth <= 3) return 'bg-green-100 text-green-800 border-green-300';
  if (depth <= 5) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-red-100 text-red-800 border-red-300';
}

function getDepthStroke(depth: number): string {
  if (depth === 0) return '#d1d5db';
  if (depth <= 3) return '#22c55e';
  if (depth <= 5) return '#eab308';
  return '#ef4444';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PeriodontalChartProps {
  patientId: number;
  readOnly?: boolean;
  onSaved?: () => void;
}

// ---------------------------------------------------------------------------
// Sub-component: inline editable depth cell
// ---------------------------------------------------------------------------

interface DepthCellProps {
  value: number;
  bleeding: boolean;
  readOnly: boolean;
  onCommit: (v: number) => void;
  onBleedingToggle: () => void;
}

function DepthCell({ value, bleeding, readOnly, onCommit, onBleedingToggle }: DepthCellProps) {
  const [editing, setEditing] = useState(false);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    onCommit(isNaN(n) ? 0 : Math.min(12, Math.max(0, n)));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        max={12}
        autoFocus
        defaultValue={value || ''}
        className="w-full h-7 text-center text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background"
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'relative w-full h-7 text-center text-xs rounded border font-medium transition-colors',
        getDepthColorClass(value),
        !readOnly && 'hover:ring-2 hover:ring-primary/30 cursor-pointer',
        readOnly && 'cursor-default',
      )}
      onClick={() => { if (!readOnly) setEditing(true); }}
      onContextMenu={e => {
        e.preventDefault();
        if (!readOnly) onBleedingToggle();
      }}
      title={readOnly ? undefined : 'Clique para editar | Clique direito para sangramento'}
    >
      {value > 0 ? value : '-'}
      {bleeding && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: SVG probing depth graph
// ---------------------------------------------------------------------------

interface ProbingGraphProps {
  teeth: readonly number[];
  sites: (keyof PeriodontalMeasurements)[];
  measurements: ChartMeasurements;
  /** When true, deeper values plot downward (standard buccal view on top) */
  invertY: boolean;
}

function ProbingGraph({ teeth, sites, measurements, invertY }: ProbingGraphProps) {
  const TOOTH_W = 60;
  const SITE_W = 18;
  const HEIGHT = 72;
  const MAX_DEPTH = 12;
  const PADDING_X = 12;

  const points = teeth.flatMap((tooth, ti) =>
    sites.map((site, si) => {
      const depth = measurements[tooth.toString()]?.probingDepth?.[site] ?? 0;
      const x = ti * TOOTH_W + si * SITE_W + PADDING_X;
      const depthFraction = depth / MAX_DEPTH;
      const y = invertY ? depthFraction * HEIGHT : (1 - depthFraction) * HEIGHT;
      const bleeding = measurements[tooth.toString()]?.bleeding?.[site] ?? false;
      return { x, y, depth, bleeding };
    }),
  );

  const hasData = points.some(p => p.depth > 0);
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Reference line at 3 mm
  const refY = invertY ? (3 / MAX_DEPTH) * HEIGHT : (1 - 3 / MAX_DEPTH) * HEIGHT;
  const totalWidth = teeth.length * TOOTH_W;

  return (
    <svg
      width={totalWidth}
      height={HEIGHT}
      className="overflow-visible block"
      aria-hidden="true"
    >
      {/* 3mm reference guide */}
      <line
        x1={0} y1={refY} x2={totalWidth} y2={refY}
        stroke="#22c55e" strokeWidth={0.5} strokeDasharray="4 2" opacity={0.6}
      />
      {/* Probing polyline */}
      {hasData && (
        <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinejoin="round" />
      )}
      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={p.depth > 0 ? 3 : 2} fill={getDepthStroke(p.depth)} />
          {p.bleeding && (
            <circle cx={p.x} cy={p.y} r={5.5} fill="none" stroke="#ef4444" strokeWidth={1} />
          )}
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: a complete arch row block (upper or lower)
// ---------------------------------------------------------------------------

interface TeethRowGroupProps {
  label: string;
  teeth: readonly number[];
  measurements: ChartMeasurements;
  readOnly: boolean;
  isUpper: boolean;
  onDepthChange: (tooth: string, site: keyof PeriodontalMeasurements, value: number) => void;
  onBleedingToggle: (tooth: string, site: keyof PeriodontalMeasurements) => void;
}

function TeethRowGroup({
  label,
  teeth,
  measurements,
  readOnly,
  isUpper,
  onDepthChange,
  onBleedingToggle,
}: TeethRowGroupProps) {
  const renderSiteHeaderRow = (sites: (keyof PeriodontalMeasurements)[]) => (
    <div className="flex items-center mb-0.5">
      <div className="w-16 text-[9px] text-muted-foreground font-medium uppercase tracking-wide shrink-0">
        {sites[1].includes('ingual') ? 'Lingual' : 'Vestibular'}
      </div>
      {teeth.map(tooth => (
        <div key={tooth} className="flex shrink-0" style={{ width: 60 }}>
          {sites.map(site => (
            <div key={site} className="flex-1 text-center text-[9px] text-muted-foreground">
              {SITE_LABELS[site]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const renderDepthRow = (sites: (keyof PeriodontalMeasurements)[]) => (
    <div className="flex">
      <div className="w-16 shrink-0" />
      {teeth.map(tooth => {
        const toothStr = tooth.toString();
        return (
          <div key={tooth} className="flex shrink-0" style={{ width: 60 }}>
            {sites.map(site => (
              <div key={site} className="flex-1 px-px py-0.5">
                <DepthCell
                  value={measurements[toothStr]?.probingDepth?.[site] ?? 0}
                  bleeding={measurements[toothStr]?.bleeding?.[site] ?? false}
                  readOnly={readOnly}
                  onCommit={v => onDepthChange(toothStr, site, v)}
                  onBleedingToggle={() => onBleedingToggle(toothStr, site)}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  const renderToothNumbers = () => (
    <div className="flex items-center my-1">
      <div className="w-16 shrink-0" />
      {teeth.map(tooth => (
        <div key={tooth} className="shrink-0 text-center text-xs font-bold" style={{ width: 60 }}>
          {tooth}
        </div>
      ))}
    </div>
  );

  const renderGraph = (sites: (keyof PeriodontalMeasurements)[], invertY: boolean) => (
    <div className="flex">
      <div className="w-16 shrink-0" />
      <ProbingGraph teeth={teeth} sites={sites} measurements={measurements} invertY={invertY} />
    </div>
  );

  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
        {label}
      </div>
      <div className="space-y-0">
        {isUpper ? (
          <>
            {renderGraph(BUCCAL_SITES, true)}
            {renderSiteHeaderRow(BUCCAL_SITES)}
            {renderDepthRow(BUCCAL_SITES)}
            {renderToothNumbers()}
            {renderDepthRow(LINGUAL_SITES)}
            {renderSiteHeaderRow(LINGUAL_SITES)}
            {renderGraph(LINGUAL_SITES, false)}
          </>
        ) : (
          <>
            {renderGraph(LINGUAL_SITES, true)}
            {renderSiteHeaderRow(LINGUAL_SITES)}
            {renderDepthRow(LINGUAL_SITES)}
            {renderToothNumbers()}
            {renderDepthRow(BUCCAL_SITES)}
            {renderSiteHeaderRow(BUCCAL_SITES)}
            {renderGraph(BUCCAL_SITES, false)}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export: PeriodontalChart
// ---------------------------------------------------------------------------

export function PeriodontalChart({ patientId, readOnly = false, onSaved }: PeriodontalChartProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing charts list
  const { data: charts = [], isLoading } = useQuery<PeriodontalChartRecord[]>({
    queryKey: [`/api/v1/patients/${patientId}/periodontal-charts`],
    enabled: !!patientId,
  });

  const latestChart = charts[0] ?? null;

  // Track whether we have seeded state from the server yet
  const seededChartIdRef = useRef<number | null>(null);

  const [measurements, setMeasurements] = useState<ChartMeasurements>(() =>
    initChart(latestChart?.teethData),
  );
  const [notes, setNotes] = useState(latestChart?.generalNotes ?? '');
  const [diagnosis, setDiagnosis] = useState(latestChart?.diagnosis ?? '');
  const [treatmentPlan, setTreatmentPlan] = useState(latestChart?.treatmentPlan ?? '');

  // Seed from server on first successful load
  if (latestChart && latestChart.id !== seededChartIdRef.current) {
    seededChartIdRef.current = latestChart.id;
    // Intentional in-render state assignment for initial hydration
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      teethData: PeriodontalToothData[];
      generalNotes?: string;
      diagnosis?: string;
      treatmentPlan?: string;
      plaqueIndex: number;
      bleedingIndex: number;
    }) => {
      const res = await apiRequest(
        'POST',
        `/api/v1/patients/${patientId}/periodontal-charts`,
        payload,
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/v1/patients/${patientId}/periodontal-charts`],
      });
      toast({ title: 'Periodontograma salvo com sucesso.' });
      onSaved?.();
    },
    onError: (err: Error) => {
      toast({
        title: 'Erro ao salvar periodontograma',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Computed indices
  // ---------------------------------------------------------------------------

  const indices = useMemo(() => {
    let totalSites = 0;
    let bleedingSites = 0;
    let plaqueSites = 0;
    let measuredSites = 0;
    let totalDepth = 0;
    let sitesOver4 = 0;

    const allSites = [...BUCCAL_SITES, ...LINGUAL_SITES];

    Object.values(measurements).forEach(tooth => {
      if (tooth.plaque) plaqueSites += allSites.length;
      allSites.forEach(site => {
        totalSites++;
        if (tooth.bleeding?.[site]) bleedingSites++;
        const d = tooth.probingDepth?.[site] ?? 0;
        if (d > 0) {
          measuredSites++;
          totalDepth += d;
          if (d >= 4) sitesOver4++;
        }
      });
    });

    return {
      bleedingIndex: totalSites > 0 ? ((bleedingSites / totalSites) * 100).toFixed(1) : '0.0',
      plaqueIndex: totalSites > 0 ? ((plaqueSites / totalSites) * 100).toFixed(1) : '0.0',
      avgDepth: measuredSites > 0 ? (totalDepth / measuredSites).toFixed(1) : '0.0',
      sitesOver4mm: sitesOver4,
      measuredSites,
      bleedingIndexNum: totalSites > 0 ? (bleedingSites / totalSites) * 100 : 0,
      plaqueIndexNum: totalSites > 0 ? (plaqueSites / totalSites) * 100 : 0,
    };
  }, [measurements]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleDepthChange = useCallback(
    (tooth: string, site: keyof PeriodontalMeasurements, value: number) => {
      setMeasurements(prev => ({
        ...prev,
        [tooth]: {
          ...prev[tooth],
          probingDepth: { ...prev[tooth]?.probingDepth, [site]: value },
        },
      }));
    },
    [],
  );

  const handleBleedingToggle = useCallback(
    (tooth: string, site: keyof PeriodontalMeasurements) => {
      if (readOnly) return;
      setMeasurements(prev => ({
        ...prev,
        [tooth]: {
          ...prev[tooth],
          bleeding: {
            ...prev[tooth]?.bleeding,
            [site]: !prev[tooth]?.bleeding?.[site],
          },
        },
      }));
    },
    [readOnly],
  );

  const handleSave = useCallback(() => {
    saveMutation.mutate({
      teethData: Object.values(measurements),
      generalNotes: notes || undefined,
      diagnosis: diagnosis || undefined,
      treatmentPlan: treatmentPlan || undefined,
      plaqueIndex: parseFloat(indices.plaqueIndex),
      bleedingIndex: parseFloat(indices.bleedingIndex),
    });
  }, [measurements, notes, diagnosis, treatmentPlan, indices, saveMutation]);

  const loadChart = useCallback((chart: PeriodontalChartRecord) => {
    setMeasurements(initChart(chart.teethData));
    setNotes(chart.generalNotes ?? '');
    setDiagnosis(chart.diagnosis ?? '');
    setTreatmentPlan(chart.treatmentPlan ?? '');
  }, []);

  // ---------------------------------------------------------------------------
  // History dialog state
  // ---------------------------------------------------------------------------

  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedHistoryChart, setSelectedHistoryChart] = useState<PeriodontalChartRecord | null>(null);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando periodontograma...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg">Carta Periodontal</CardTitle>
            <div className="flex gap-2 flex-wrap items-center">
              <Badge variant="outline">IP: {indices.plaqueIndex}%</Badge>
              <Badge variant="outline">IS: {indices.bleedingIndex}%</Badge>
              <Badge variant="outline">Prof. média: {indices.avgDepth} mm</Badge>
              <Badge variant={indices.sitesOver4mm > 0 ? 'destructive' : 'outline'}>
                Sítios &ge;4mm: {indices.sitesOver4mm}
              </Badge>
              {charts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistoryDialog(true)}
                >
                  <History className="h-4 w-4 mr-1" />
                  Histórico ({charts.length})
                </Button>
              )}
              {!readOnly && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {charts.length === 0 ? 'Criar Periodontograma' : 'Salvar Nova Versão'}
                </Button>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" />
              1-3mm Normal
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" />
              4-5mm Moderado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />
              6+mm Severo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Sangramento (clique direito)
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 overflow-x-auto">
          {/* Upper arch */}
          <TeethRowGroup
            label="Arcada Superior"
            teeth={UPPER_TEETH}
            measurements={measurements}
            readOnly={readOnly}
            isUpper={true}
            onDepthChange={handleDepthChange}
            onBleedingToggle={handleBleedingToggle}
          />

          <div className="border-t border-dashed" />

          {/* Lower arch */}
          <TeethRowGroup
            label="Arcada Inferior"
            teeth={LOWER_TEETH}
            measurements={measurements}
            readOnly={readOnly}
            isUpper={false}
            onDepthChange={handleDepthChange}
            onBleedingToggle={handleBleedingToggle}
          />

          {/* Notes / diagnosis fields */}
          {!readOnly && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
              <div className="space-y-1">
                <Label htmlFor="perio-notes">Observações Gerais</Label>
                <Textarea
                  id="perio-notes"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Observações sobre o exame periodontal..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="perio-diagnosis">Diagnóstico Periodontal</Label>
                <Textarea
                  id="perio-diagnosis"
                  rows={3}
                  value={diagnosis}
                  onChange={e => setDiagnosis(e.target.value)}
                  placeholder="Diagnóstico periodontal..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="perio-treatment">Plano de Tratamento</Label>
                <Textarea
                  id="perio-treatment"
                  rows={3}
                  value={treatmentPlan}
                  onChange={e => setTreatmentPlan(e.target.value)}
                  placeholder="Plano de tratamento periodontal..."
                />
              </div>
            </div>
          )}

          {readOnly && (latestChart?.generalNotes || latestChart?.diagnosis || latestChart?.treatmentPlan) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
              {latestChart.generalNotes && (
                <div>
                  <p className="text-sm font-medium mb-1">Observações Gerais</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    {latestChart.generalNotes}
                  </p>
                </div>
              )}
              {latestChart.diagnosis && (
                <div>
                  <p className="text-sm font-medium mb-1">Diagnóstico</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    {latestChart.diagnosis}
                  </p>
                </div>
              )}
              {latestChart.treatmentPlan && (
                <div>
                  <p className="text-sm font-medium mb-1">Plano de Tratamento</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    {latestChart.treatmentPlan}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de Periodontogramas</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {charts.map(chart => (
              <button
                key={chart.id}
                type="button"
                className={cn(
                  'w-full text-left border rounded-lg p-3 hover:bg-accent transition-colors',
                  selectedHistoryChart?.id === chart.id && 'ring-2 ring-primary bg-accent',
                )}
                onClick={() => setSelectedHistoryChart(chart)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {format(new Date(chart.chartDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  <div className="flex gap-1">
                    {chart.bleedingIndex && (
                      <Badge variant="outline" className="text-[10px]">
                        IS: {parseFloat(chart.bleedingIndex).toFixed(1)}%
                      </Badge>
                    )}
                    {chart.plaqueIndex && (
                      <Badge variant="outline" className="text-[10px]">
                        IP: {parseFloat(chart.plaqueIndex).toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </div>
                {chart.diagnosis && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{chart.diagnosis}</p>
                )}
              </button>
            ))}
          </div>
          {selectedHistoryChart && (
            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground mb-2">
                Carregar periodontograma de{' '}
                <strong>
                  {format(new Date(selectedHistoryChart.chartDate), 'dd/MM/yyyy', { locale: ptBR })}
                </strong>
                {' '}no editor?
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelectedHistoryChart(null)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    loadChart(selectedHistoryChart);
                    setSelectedHistoryChart(null);
                    setShowHistoryDialog(false);
                  }}
                >
                  Carregar
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowHistoryDialog(false); setSelectedHistoryChart(null); }}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
