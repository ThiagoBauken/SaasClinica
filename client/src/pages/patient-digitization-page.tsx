import { useState, useCallback, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/core/AuthProvider";
import { Upload, FileImage, Loader2, CheckCircle, XCircle, Trash2, Download, History, FolderOpen, AlertTriangle, FileSpreadsheet, FileText, FileJson } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ExtractedPatient {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  cpf?: string;
  dateOfBirth?: string;
  address?: string;
  status: "processing" | "success" | "error" | "duplicate";
  error?: string;
  isDuplicate?: boolean;
  duplicateMatches?: DuplicateMatch[];
}

interface DuplicateMatch {
  existingPatientId: number;
  existingPatientName: string;
  matchScore: number;
  matchReasons: string[];
}

interface DigitizationHistory {
  id: number;
  processedAt: string;
  totalFiles: number;
  successCount: number;
  errorCount: number;
  outputFormat: string;
  downloadUrl?: string;
}

interface FileWithPreview extends File {
  preview?: string;
}

interface MergeDialogData {
  patient: ExtractedPatient;
  index: number;
}

export default function PatientDigitizationPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedPatients, setExtractedPatients] = useState<ExtractedPatient[]>([]);
  const [outputFormat, setOutputFormat] = useState("database");
  const [history, setHistory] = useState<DigitizationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeDialogData, setMergeDialogData] = useState<MergeDialogData | null>(null);
  const [pendingDuplicates, setPendingDuplicates] = useState<ExtractedPatient[]>([]);
  const [storageInfo, setStorageInfo] = useState<{path: string; size: number} | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [selectedExportFormat, setSelectedExportFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');

  // Fetch digitization history on mount
  useEffect(() => {
    fetchHistory();
    fetchStorageInfo();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/v1/patients/digitization/history', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchStorageInfo = async () => {
    try {
      const response = await fetch('/api/v1/patients/digitization/storage', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStorageInfo(data);
      }
    } catch (error) {
      console.error('Error fetching storage info:', error);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file =>
      file.type.startsWith('image/') || file.name.endsWith('.zip')
    );

    if (validFiles.length !== droppedFiles.length) {
      toast({
        title: "Aviso",
        description: "Apenas arquivos de imagem e ZIP são aceitos",
        variant: "destructive",
      });
    }

    const filesWithPreview = validFiles.map(file => {
      const fileWithPreview = file as FileWithPreview;
      if (file.type.startsWith('image/')) {
        fileWithPreview.preview = URL.createObjectURL(file);
      }
      return fileWithPreview;
    });

    setFiles(prev => [...prev, ...filesWithPreview]);
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);
    const filesWithPreview = selectedFiles.map(file => {
      const fileWithPreview = file as FileWithPreview;
      if (file.type.startsWith('image/')) {
        fileWithPreview.preview = URL.createObjectURL(file);
      }
      return fileWithPreview;
    });

    setFiles(prev => [...prev, ...filesWithPreview]);
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const clearAllFiles = () => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    setExtractedPatients([]);
    setProgress(0);
  };

  const handleDuplicateDecision = async (decision: 'merge' | 'new' | 'skip', existingPatientId?: number) => {
    if (!mergeDialogData) return;

    try {
      const response = await fetch('/api/v1/patients/digitization/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patient: mergeDialogData.patient,
          decision,
          existingPatientId,
        }),
      });

      if (!response.ok) throw new Error('Erro ao resolver duplicata');

      const result = await response.json();

      // Update patient status
      setExtractedPatients(prev => {
        const newPatients = [...prev];
        newPatients[mergeDialogData.index] = {
          ...newPatients[mergeDialogData.index],
          status: 'success',
          isDuplicate: false,
        };
        return newPatients;
      });

      toast({
        title: "Sucesso",
        description: decision === 'merge' ? 'Paciente atualizado com sucesso' :
                    decision === 'new' ? 'Novo paciente criado' : 'Paciente ignorado',
      });

      // Remove current duplicate from pending list
      const remaining = pendingDuplicates.slice(1);
      setPendingDuplicates(remaining);

      // Show next duplicate if any
      if (remaining.length > 0) {
        setMergeDialogData({
          patient: remaining[0],
          index: 0,
        });
        toast({
          title: "Próxima Duplicata",
          description: `Ainda há ${remaining.length} duplicata(s) para revisar`,
        });
      } else {
        setMergeDialogOpen(false);
        setMergeDialogData(null);
        toast({
          title: "Todas as Duplicatas Resolvidas",
          description: "Todas as duplicatas foram processadas",
        });
        fetchHistory();
      }
    } catch (error) {
      console.error('Error resolving duplicate:', error);
      toast({
        title: "Erro",
        description: "Erro ao resolver duplicata",
        variant: "destructive",
      });
    }
  };

  const processImages = async () => {
    if (files.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma imagem ou arquivo ZIP",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setExtractedPatients([]);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('outputFormat', outputFormat);

    try {
      const response = await fetch('/api/v1/patients/digitization', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        // If response is a file download
        if (outputFormat !== 'database') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `patients_${new Date().toISOString().split('T')[0]}.${outputFormat}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          toast({
            title: "Sucesso",
            description: "Arquivo exportado com sucesso",
          });

          fetchHistory();
          clearAllFiles();
          setIsProcessing(false);
          return;
        }
        throw new Error('Erro ao processar imagens');
      }

      const data = await response.json();

      setExtractedPatients(data.patients || []);
      setProgress(100);

      // Check for duplicates and show merge dialog
      const duplicates = data.patients?.filter((p: ExtractedPatient) => p.isDuplicate);
      if (duplicates && duplicates.length > 0) {
        setPendingDuplicates(duplicates);

        toast({
          title: "Duplicatas Detectadas",
          description: `${duplicates.length} possível(is) duplicata(s) encontrada(s). Revise cada uma.`,
          variant: "default",
        });

        // Show merge dialog for first duplicate
        setMergeDialogData({
          patient: duplicates[0],
          index: 0,
        });
        setMergeDialogOpen(true);
      }

      toast({
        title: "Sucesso",
        description: `${data.patients?.length || 0} prontuários processados`,
      });

      if (outputFormat === 'database') {
        toast({
          title: "Pacientes Salvos",
          description: "Os dados foram salvos no banco de dados",
        });
      }

      fetchHistory();
      fetchStorageInfo();
    } catch (error) {
      console.error('Error processing images:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar as imagens",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadHistoryFile = async (historyId: number, format?: string) => {
    try {
      const response = await fetch(`/api/v1/patients/digitization/history/${historyId}/download`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Erro ao baixar arquivo');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use format from history item if available, otherwise default to xlsx
      const fileExtension = format || 'xlsx';
      a.download = `digitization_${historyId}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Erro",
        description: "Erro ao baixar arquivo",
        variant: "destructive",
      });
    }
  };

  const reprocessHistory = async (historyId: number, action: 'database' | 'export', format?: 'xlsx' | 'csv' | 'json') => {
    try {
      const exportFormat = action === 'export' ? (format || 'xlsx') : undefined;

      const response = await fetch(`/api/v1/patients/digitization/history/${historyId}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action, format: exportFormat }),
      });

      if (!response.ok) throw new Error('Erro ao reprocessar dados');

      const result = await response.json();

      if (action === 'database') {
        toast({
          title: "Sucesso",
          description: result.message || "Dados adicionados ao banco de dados",
        });
        fetchHistory();
      } else if (action === 'export' && result.downloadUrl) {
        // Download the exported file
        const downloadResponse = await fetch(result.downloadUrl);
        const blob = await downloadResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Use the selected format for the file extension
        const fileExtension = exportFormat || 'xlsx';
        a.download = `reexport_${historyId}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Sucesso",
          description: "Arquivo exportado com sucesso",
        });
      }
    } catch (error) {
      console.error('Error reprocessing history:', error);
      toast({
        title: "Erro",
        description: "Erro ao reprocessar dados",
        variant: "destructive",
      });
    }
  };

  const openExportDialog = (historyId: number) => {
    setSelectedHistoryId(historyId);
    setSelectedExportFormat('xlsx');
    setExportDialogOpen(true);
  };

  const confirmExport = async () => {
    if (!selectedHistoryId) return;
    setExportDialogOpen(false);
    await reprocessHistory(selectedHistoryId, 'export', selectedExportFormat);
  };

  return (
    <DashboardLayout title="Digitalização de Prontuários" currentPath="/pacientes/digitalizar">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Digitalização de Prontuários</h1>
            <p className="text-muted-foreground">
              Faça upload de fotos ou arquivos ZIP com centenas de fichas de pacientes
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
            <History className="h-4 w-4 mr-2" />
            {showHistory ? 'Ocultar' : 'Ver'} Histórico
          </Button>
        </div>

        {/* Storage Info */}
        {storageInfo && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm">
                <FolderOpen className="h-4 w-4" />
                <span className="text-muted-foreground">Local de armazenamento:</span>
                <code className="bg-background px-2 py-1 rounded text-xs">{storageInfo.path}</code>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">Tamanho total: {(storageInfo.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History Section */}
        {showHistory && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Digitalizações</CardTitle>
              <CardDescription>{history.length} processamento(s) realizado(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum histórico de digitalização encontrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Total de Arquivos</TableHead>
                      <TableHead>Sucesso</TableHead>
                      <TableHead>Erros</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{new Date(item.processedAt).toLocaleString('pt-BR')}</TableCell>
                        <TableCell>{item.totalFiles}</TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-500">
                            {item.successCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.errorCount > 0 && (
                            <Badge variant="destructive">{item.errorCount}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{item.outputFormat}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {item.downloadUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadHistoryFile(item.id, item.outputFormat)}
                                title="Baixar arquivo exportado"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reprocessHistory(item.id, 'database')}
                              title="Adicionar ao banco de dados"
                            >
                              💾
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openExportDialog(item.id)}
                              title="Exportar - escolher formato"
                            >
                              📤
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload de Arquivos</CardTitle>
            <CardDescription>
              Arraste imagens individuais ou arquivos ZIP com múltiplas fotos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                multiple
                accept="image/*,.zip"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste arquivos aqui ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPG, JPEG, TIFF ou ZIP
                </p>
                <p className="text-xs text-muted-foreground mt-1 text-primary">
                  Suporta centenas/milhares de fotos em ZIP
                </p>
              </label>
            </div>

            {files.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium">
                    {files.length} arquivo(s) selecionado(s)
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFiles}
                    disabled={isProcessing}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar Tudo
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <div className="flex items-center space-x-2">
                        {file.preview ? (
                          <img
                            src={file.preview}
                            alt={file.name}
                            className="h-10 w-10 object-cover rounded"
                          />
                        ) : (
                          <FileImage className="h-10 w-10 p-2" />
                        )}
                        <span className="text-sm truncate max-w-[200px]">
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isProcessing}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>
              Configure o processamento e formato de saída
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="output-format">Formato de Saída</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger id="output-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="database">Salvar no Banco de Dados</SelectItem>
                  <SelectItem value="xlsx">Exportar Excel (XLSX)</SelectItem>
                  <SelectItem value="csv">Exportar CSV</SelectItem>
                  <SelectItem value="json">Exportar JSON</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ao salvar no banco, duplicatas serão detectadas automaticamente
              </p>
            </div>

            <Button
              onClick={processImages}
              disabled={isProcessing || files.length === 0}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Processar Arquivos
                </>
              )}
            </Button>

            {isProcessing && progress > 0 && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  {progress}% concluído
                </p>
              </div>
            )}

            <div className="pt-4 border-t space-y-2">
              <p className="text-sm font-medium">Processamento Automático:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• ZIP é automaticamente extraído</li>
                <li>• Imagens são processadas em lote</li>
                <li>• Arquivos temporários são deletados após processamento</li>
                <li>• Duplicatas são detectadas por nome, CPF e data de nascimento</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {extractedPatients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pacientes Extraídos</CardTitle>
            <CardDescription>
              {extractedPatients.length} paciente(s) processado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {extractedPatients.map((patient, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg space-y-2 ${
                    patient.isDuplicate ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{patient.name}</h3>
                      {patient.isDuplicate && (
                        <Badge variant="outline" className="text-yellow-700 border-yellow-500">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Possível Duplicata
                        </Badge>
                      )}
                    </div>
                    {patient.status === "success" && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {patient.status === "error" && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    {patient.status === "processing" && (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {patient.phone && (
                      <div>
                        <span className="text-muted-foreground">Telefone: </span>
                        {patient.phone}
                      </div>
                    )}
                    {patient.email && (
                      <div>
                        <span className="text-muted-foreground">Email: </span>
                        {patient.email}
                      </div>
                    )}
                    {patient.cpf && (
                      <div>
                        <span className="text-muted-foreground">CPF: </span>
                        {patient.cpf}
                      </div>
                    )}
                    {patient.dateOfBirth && (
                      <div>
                        <span className="text-muted-foreground">Nascimento: </span>
                        {patient.dateOfBirth}
                      </div>
                    )}
                    {patient.address && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Endereço: </span>
                        {patient.address}
                      </div>
                    )}
                  </div>
                  {patient.error && (
                    <p className="text-sm text-red-500">{patient.error}</p>
                  )}
                  {patient.isDuplicate && patient.duplicateMatches && (
                    <div className="mt-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMergeDialogData({ patient, index });
                          setMergeDialogOpen(true);
                        }}
                      >
                        Resolver Duplicata
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Merge Conflict Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Duplicata Detectada</DialogTitle>
            <DialogDescription>
              Encontramos paciente(s) com dados semelhantes. Como deseja proceder?
            </DialogDescription>
          </DialogHeader>

          {mergeDialogData && (
            <div className="space-y-4">
              <div className="p-4 border rounded bg-muted">
                <h4 className="font-semibold mb-2">Novo Paciente Detectado:</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Nome:</strong> {mergeDialogData.patient.name}</p>
                  {mergeDialogData.patient.cpf && <p><strong>CPF:</strong> {mergeDialogData.patient.cpf}</p>}
                  {mergeDialogData.patient.dateOfBirth && <p><strong>Data Nasc.:</strong> {mergeDialogData.patient.dateOfBirth}</p>}
                  {mergeDialogData.patient.phone && <p><strong>Telefone:</strong> {mergeDialogData.patient.phone}</p>}
                </div>
              </div>

              {mergeDialogData.patient.duplicateMatches && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Pacientes Existentes Similares:</h4>
                  {mergeDialogData.patient.duplicateMatches.map((match, idx) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{match.existingPatientName}</span>
                        <Badge variant="secondary">{Math.round(match.matchScore * 100)}% similar</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>Motivos da correspondência:</p>
                        <ul className="list-disc list-inside mt-1">
                          {match.matchReasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleDuplicateDecision('merge', match.existingPatientId)}
                        >
                          Atualizar Este Paciente
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDuplicateDecision('skip')}
            >
              Pular (Não Salvar)
            </Button>
            <Button
              onClick={() => handleDuplicateDecision('new')}
            >
              Criar Novo Paciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Format Selection Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escolher Formato de Exportação</DialogTitle>
            <DialogDescription>
              Selecione o formato para exportar os dados do histórico
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Formato do Arquivo</Label>
              <Select
                value={selectedExportFormat}
                onValueChange={(value: 'xlsx' | 'csv' | 'json') => setSelectedExportFormat(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Excel (.xlsx)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>CSV (.csv)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="json">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      <span>JSON (.json)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground">
              {selectedExportFormat === 'xlsx' && '📊 Excel - Melhor para análise de dados e planilhas'}
              {selectedExportFormat === 'csv' && '📄 CSV - Compatível com qualquer sistema'}
              {selectedExportFormat === 'json' && '💻 JSON - Ideal para integrações e APIs'}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
