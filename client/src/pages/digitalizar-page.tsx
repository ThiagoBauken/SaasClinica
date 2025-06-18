import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  FileText, 
  Brain, 
  Download, 
  Trash2, 
  Eye, 
  X, 
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface DigitalizationFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

interface ProcessingHistory {
  id: string;
  filename: string;
  createdAt: string;
  recordCount: number;
  format: string;
  status: 'completed' | 'processing' | 'error';
  downloadUrl?: string;
}

export default function DigitalizarPage() {
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<DigitalizationFile[]>([]);
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [outputFormat, setOutputFormat] = useState('xlsx');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Buscar histórico de processamentos
  const { data: history = [], isLoading: historyLoading, refetch } = useQuery({
    queryKey: ['/api/digitalizacao/history'],
    staleTime: 30000,
    retry: false
  });

  // Mutation para processar arquivos
  const processMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      setIsProcessing(true);
      setUploadProgress(0);

      const response = await fetch('/api/digitalizacao/process', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro no processamento');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setIsProcessing(false);
      setSelectedFiles([]);
      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ['/api/digitalizacao/history'] });
      
      toast({
        title: "Processamento iniciado",
        description: `${data.recordCount || 0} registros sendo processados`,
      });
      
      setTimeout(() => setUploadProgress(0), 2000);
    },
    onError: (error: any) => {
      setIsProcessing(false);
      setUploadProgress(0);
      
      toast({
        title: "Erro no processamento",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation para download
  const downloadMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const response = await fetch(`/api/digitalizacao/download/${recordId}`);
      if (!response.ok) throw new Error('Arquivo não encontrado');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `digitalizacao_${recordId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "Download iniciado",
        description: "O arquivo está sendo baixado",
      });
    },
    onError: () => {
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o arquivo",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newFiles: DigitalizationFile[] = files.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Selecione pelo menos um arquivo para processar",
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    
    // Reconstruct File objects from selected files
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput?.files) {
      Array.from(fileInput.files).forEach(file => {
        formData.append('files', file);
      });
    }
    
    formData.append('aiModel', aiModel);
    formData.append('outputFormat', outputFormat);
    formData.append('customPrompt', customPrompt);

    processMutation.mutate(formData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Digitalizar Fichas Odontológicas</h1>
          <p className="text-muted-foreground">
            Converta fichas físicas em dados digitais estruturados usando IA
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Fichas
            </CardTitle>
            <CardDescription>
              Selecione as fichas odontológicas para digitalização
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Selecione as fichas</h3>
                <p className="text-sm text-muted-foreground">
                  Arraste arquivos aqui ou clique para selecionar
                </p>
              </div>
              
              <Input
                id="file-upload"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <Button variant="outline" className="mt-4">
                  Selecionar Arquivos
                </Button>
              </Label>
              
              <p className="text-xs text-muted-foreground mt-4">
                Formatos: PDF, JPG, PNG (máx. 20 arquivos, 10MB cada)
              </p>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  Arquivos selecionados ({selectedFiles.length})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Enviando arquivos...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processing Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Configuração do Processamento
            </CardTitle>
            <CardDescription>
              Configure como a IA deve processar as fichas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-model">Modelo de IA</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4 Vision (Recomendado)</SelectItem>
                  <SelectItem value="claude-3-vision">Claude 3 Vision</SelectItem>
                  <SelectItem value="gemini-vision">Gemini Vision Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="output-format">Formato de Saída</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                  <SelectItem value="pdf">PDF Estruturado</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-prompt">Prompt Personalizado (Opcional)</Label>
              <Textarea
                id="custom-prompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Instruções específicas para extração de dados..."
                rows={3}
              />
            </div>

            <Button
              onClick={handleProcess}
              disabled={selectedFiles.length === 0 || isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Processar Fichas
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Processamentos
          </CardTitle>
          <CardDescription>
            Visualize e baixe os processamentos anteriores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando histórico...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-2">Nenhum processamento realizado</h3>
              <p className="text-sm">
                Quando você processar fichas, o histórico aparecerá aqui
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record: ProcessingHistory) => (
                <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    {record.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    {record.status === 'processing' && <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />}
                    {record.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{record.filename}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{new Date(record.createdAt).toLocaleDateString('pt-BR')}</span>
                        <span>{record.recordCount} registros</span>
                        <Badge variant="outline">{record.format.toUpperCase()}</Badge>
                      </div>
                    </div>
                  </div>
                  
                  {record.status === 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadMutation.mutate(record.id)}
                      disabled={downloadMutation.isPending}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}