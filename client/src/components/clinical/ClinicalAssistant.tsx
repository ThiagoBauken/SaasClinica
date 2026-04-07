import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getCsrfHeaders } from '@/lib/csrf';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Send,
  Brain,
  Save,
  History,
  AlertTriangle,
  Pill,
  Stethoscope,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface ClinicalFinding {
  description: string;
  severity: 'low' | 'medium' | 'high';
  toothId?: string;
}

interface TreatmentSuggestion {
  procedure: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  toothId?: string;
  justification: string;
}

interface MedicationSuggestion {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: 'oral' | 'topical';
  notes?: string;
}

interface ClinicalAlert {
  type: 'contraindication' | 'interaction' | 'precaution';
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

interface ClinicalAnalysis {
  clinicalFindings: ClinicalFinding[];
  treatmentSuggestions: TreatmentSuggestion[];
  medicationSuggestions: MedicationSuggestion[];
  alerts: ClinicalAlert[];
  summary: string;
}

interface ClinicalNoteRecord {
  id: number;
  patientId: number;
  recordType: string;
  content: {
    transcription: string;
    analysis: ClinicalAnalysis;
    timestamp: string;
  };
  createdAt: string;
}

interface ClinicalAssistantProps {
  patientId: number;
  patientName: string;
}

// ============================================================
// Helpers
// ============================================================

const severityColors = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

const priorityColors = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const priorityLabels = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const alertStyles = {
  critical: 'bg-red-50 border-red-300 text-red-900',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-900',
  info: 'bg-blue-50 border-blue-300 text-blue-900',
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================
// Component
// ============================================================

export default function ClinicalAssistant({ patientId, patientName }: ClinicalAssistantProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('record');

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Transcription state
  const [transcription, setTranscription] = useState('');

  // Analysis state
  const [analysis, setAnalysis] = useState<ClinicalAnalysis | null>(null);

  // History expand state
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  // ============================================================
  // Auto-save: localStorage draft (prevents data loss on crash)
  // ============================================================
  const DRAFT_KEY = `clinical-draft-${patientId}`;

  // Restore draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        // Only restore if less than 24h old
        if (Date.now() - parsed.savedAt < 86400000) {
          if (parsed.transcription && !transcription) {
            setTranscription(parsed.transcription);
          }
          if (parsed.analysis && !analysis) {
            setAnalysis(parsed.analysis);
          }
          toast({
            title: 'Rascunho restaurado',
            description: 'Um rascunho anterior foi recuperado automaticamente.',
          });
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [patientId]);

  // Save draft to localStorage (debounced 3s)
  useEffect(() => {
    if (!transcription && !analysis) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          transcription,
          analysis,
          savedAt: Date.now(),
        }));
      } catch {
        // localStorage full or unavailable
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [transcription, analysis, DRAFT_KEY]);

  // ============================================================
  // Audio Recording
  // ============================================================

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000); // Chunks a cada 1s
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioBlob(null);
      setAudioUrl(null);
      setTranscription('');
      setAnalysis(null);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      toast({
        title: 'Erro ao acessar microfone',
        description: 'Verifique as permissoes do navegador para uso do microfone.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (!audioPlayerRef.current || !audioUrl) return;

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, audioUrl]);

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setTranscription('');
    setAnalysis(null);
  }, [audioUrl]);

  // ============================================================
  // Mutations
  // ============================================================

  const transcribeMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const csrfHeaders = getCsrfHeaders();
      const res = await fetch('/api/v1/clinical-assistant/transcribe', {
        method: 'POST',
        credentials: 'include',
        headers: csrfHeaders,
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Erro na transcricao');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setTranscription(data.transcription.text);
      toast({ title: 'Transcricao concluida!' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Erro na transcricao',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest('POST', '/api/v1/clinical-assistant/analyze', {
        transcription: text,
        patientId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      setActiveTab('analysis');
      toast({ title: 'Analise concluida!' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Erro na analise',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!analysis) throw new Error('Sem analise para salvar');
      const res = await apiRequest('POST', '/api/v1/clinical-assistant/save-note', {
        patientId,
        transcription,
        analysis,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/v1/clinical-assistant/history/${patientId}`],
      });
      // Clear auto-save draft after successful save
      localStorage.removeItem(DRAFT_KEY);
      toast({ title: 'Nota clinica salva com sucesso!' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // ============================================================
  // History Query
  // ============================================================

  const { data: historyData } = useQuery<{ success: boolean; history: ClinicalNoteRecord[] }>({
    queryKey: [`/api/v1/clinical-assistant/history/${patientId}`],
    enabled: !!patientId,
  });

  const history = historyData?.history || [];

  const toggleNoteExpand = (id: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold">Assistente Clinico IA</h3>
        <Badge variant="outline" className="text-xs">
          Paciente: {patientName}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="record" className="flex items-center gap-1.5">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Gravar</span>
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-1.5">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Analise IA</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Historico</span>
            {history.length > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {history.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* TAB: GRAVAR */}
        {/* ============================================ */}
        <TabsContent value="record" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Gravacao de Audio</CardTitle>
              <CardDescription>
                Grave suas observacoes clinicas sobre o paciente. A IA ira transcrever e analisar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recording Controls */}
              <div className="flex flex-col items-center gap-4 py-6">
                {!isRecording && !audioBlob && (
                  <Button
                    size="lg"
                    onClick={startRecording}
                    className="h-20 w-20 rounded-full bg-red-500 hover:bg-red-600 shadow-lg"
                  >
                    <Mic className="h-8 w-8 text-white" />
                  </Button>
                )}

                {isRecording && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-lg font-mono font-semibold text-red-600">
                        {formatDuration(recordingDuration)}
                      </span>
                    </div>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={stopRecording}
                      className="h-16 w-16 rounded-full border-2 border-red-400"
                    >
                      <Square className="h-6 w-6 text-red-500" />
                    </Button>
                    <p className="text-sm text-muted-foreground">Gravando... Clique para parar</p>
                  </>
                )}

                {audioBlob && !isRecording && (
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={togglePlayback}
                        className="gap-1.5"
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        {isPlaying ? 'Pausar' : 'Ouvir'}
                      </Button>
                      <span className="text-sm text-muted-foreground font-mono">
                        {formatDuration(recordingDuration)}
                      </span>
                      <Button variant="ghost" size="sm" onClick={resetRecording}>
                        <MicOff className="h-4 w-4 mr-1" />
                        Nova gravacao
                      </Button>
                    </div>

                    {audioUrl && (
                      <audio
                        ref={audioPlayerRef}
                        src={audioUrl}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                      />
                    )}

                    <Button
                      className="w-full gap-2"
                      onClick={() => transcribeMutation.mutate(audioBlob)}
                      disabled={transcribeMutation.isPending}
                    >
                      {transcribeMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Transcrevendo...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Transcrever Audio
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {!isRecording && !audioBlob && (
                  <p className="text-sm text-muted-foreground text-center">
                    Clique no botao para iniciar a gravacao da consulta
                  </p>
                )}
              </div>

              {/* Transcription */}
              {(transcription || transcribeMutation.isPending) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Transcricao
                  </label>
                  {transcribeMutation.isPending ? (
                    <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        Processando audio com IA...
                      </span>
                    </div>
                  ) : (
                    <>
                      <Textarea
                        value={transcription}
                        onChange={(e) => setTranscription(e.target.value)}
                        rows={6}
                        placeholder="A transcricao aparecera aqui..."
                        className="resize-y"
                      />
                      <p className="text-xs text-muted-foreground">
                        Voce pode editar a transcricao antes de analisar
                      </p>
                      <Button
                        className="w-full gap-2"
                        variant="default"
                        onClick={() => analyzeMutation.mutate(transcription)}
                        disabled={!transcription.trim() || analyzeMutation.isPending}
                      >
                        {analyzeMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analisando com IA...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4" />
                            Analisar com IA
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: ANALISE IA */}
        {/* ============================================ */}
        <TabsContent value="analysis" className="space-y-4">
          {!analysis && !analyzeMutation.isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-3">
                  <Brain className="h-12 w-12 mx-auto text-purple-200" />
                  <p className="text-muted-foreground">
                    Grave e transcreva o audio primeiro para receber a analise da IA
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab('record')}>
                    <Mic className="h-4 w-4 mr-2" />
                    Ir para Gravacao
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {analyzeMutation.isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  <p className="text-muted-foreground">
                    Analisando transcricao e cruzando com dados do paciente...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {analysis && (
            <>
              {/* Summary */}
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm font-medium">{analysis.summary}</p>
                </CardContent>
              </Card>

              {/* Alerts */}
              {analysis.alerts.length > 0 && (
                <div className="space-y-2">
                  {analysis.alerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border flex items-start gap-2 ${alertStyles[alert.severity]}`}
                    >
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-semibold uppercase">
                          {alert.type === 'contraindication'
                            ? 'Contraindicacao'
                            : alert.type === 'interaction'
                              ? 'Interacao'
                              : 'Precaucao'}
                        </span>
                        <p className="text-sm mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Clinical Findings */}
              {analysis.clinicalFindings.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Achados Clinicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysis.clinicalFindings.map((finding, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border ${severityColors[finding.severity]}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm">{finding.description}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {finding.toothId && (
                                <Badge variant="outline" className="text-xs">
                                  Dente {finding.toothId}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Treatment Suggestions */}
              {analysis.treatmentSuggestions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Sugestoes de Tratamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysis.treatmentSuggestions.map((suggestion, i) => (
                        <div key={i} className="p-3 rounded-lg border bg-white">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-medium text-sm">{suggestion.procedure}</span>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <Badge className={priorityColors[suggestion.priority]}>
                                {priorityLabels[suggestion.priority]}
                              </Badge>
                              {suggestion.toothId && (
                                <Badge variant="outline" className="text-xs">
                                  Dente {suggestion.toothId}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{suggestion.justification}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Medication Suggestions */}
              {analysis.medicationSuggestions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-4 w-4" />
                      Sugestoes de Medicamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysis.medicationSuggestions.map((med, i) => (
                        <div key={i} className="p-3 rounded-lg border bg-white">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-medium text-sm">{med.name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {med.route === 'oral' ? 'Via oral' : 'Topico'}
                              </Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium text-foreground">Dose:</span>{' '}
                              {med.dosage}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Freq:</span>{' '}
                              {med.frequency}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Duracao:</span>{' '}
                              {med.duration}
                            </div>
                          </div>
                          {med.notes && (
                            <p className="text-xs text-muted-foreground mt-1.5 italic">
                              {med.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Save Button */}
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || saveMutation.isSuccess}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : saveMutation.isSuccess ? (
                  <>
                    <Save className="h-4 w-4" />
                    Nota salva!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar Nota Clinica
                  </>
                )}
              </Button>
            </>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: HISTORICO */}
        {/* ============================================ */}
        <TabsContent value="history" className="space-y-3">
          {history.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-2">
                  <History className="h-12 w-12 mx-auto text-gray-200" />
                  <p className="text-muted-foreground">
                    Nenhuma nota clinica com IA registrada para este paciente
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3 pr-2">
                {history.map((note) => {
                  const isExpanded = expandedNotes.has(note.id);
                  const content = note.content;

                  return (
                    <Card key={note.id} className="overflow-hidden">
                      <button
                        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                        onClick={() => toggleNoteExpand(note.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(note.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm line-clamp-2">
                              {content.analysis?.summary || 'Nota clinica'}
                            </p>
                            {content.analysis?.alerts?.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {content.analysis.alerts
                                  .filter((a: ClinicalAlert) => a.severity === 'critical')
                                  .slice(0, 2)
                                  .map((a: ClinicalAlert, i: number) => (
                                    <Badge key={i} variant="destructive" className="text-[10px]">
                                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                                      {a.message.substring(0, 40)}...
                                    </Badge>
                                  ))}
                              </div>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t pt-3">
                          {/* Transcription */}
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase">
                              Transcricao
                            </span>
                            <p className="text-sm mt-1 bg-gray-50 p-2 rounded">
                              {content.transcription}
                            </p>
                          </div>

                          {/* Findings */}
                          {content.analysis?.clinicalFindings?.length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground uppercase">
                                Achados
                              </span>
                              <div className="space-y-1 mt-1">
                                {content.analysis.clinicalFindings.map(
                                  (f: ClinicalFinding, i: number) => (
                                    <div
                                      key={i}
                                      className={`text-xs p-1.5 rounded ${severityColors[f.severity]}`}
                                    >
                                      {f.description}
                                      {f.toothId && ` (Dente ${f.toothId})`}
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                          {/* Treatments */}
                          {content.analysis?.treatmentSuggestions?.length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground uppercase">
                                Tratamentos
                              </span>
                              <div className="space-y-1 mt-1">
                                {content.analysis.treatmentSuggestions.map(
                                  (t: TreatmentSuggestion, i: number) => (
                                    <div key={i} className="text-xs p-1.5 rounded bg-blue-50">
                                      <span className="font-medium">{t.procedure}</span>
                                      {t.toothId && ` - Dente ${t.toothId}`}
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                          {/* Medications */}
                          {content.analysis?.medicationSuggestions?.length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground uppercase">
                                Medicamentos
                              </span>
                              <div className="space-y-1 mt-1">
                                {content.analysis.medicationSuggestions.map(
                                  (m: MedicationSuggestion, i: number) => (
                                    <div key={i} className="text-xs p-1.5 rounded bg-green-50">
                                      <span className="font-medium">{m.name}</span> - {m.dosage}{' '}
                                      {m.frequency} por {m.duration}
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                          {/* Alerts */}
                          {content.analysis?.alerts?.length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground uppercase">
                                Alertas
                              </span>
                              <div className="space-y-1 mt-1">
                                {content.analysis.alerts.map((a: ClinicalAlert, i: number) => (
                                  <div
                                    key={i}
                                    className={`text-xs p-1.5 rounded border ${alertStyles[a.severity]}`}
                                  >
                                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                                    {a.message}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
