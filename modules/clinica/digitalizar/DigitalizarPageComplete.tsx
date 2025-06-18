import React, { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  CheckCircle, 
  AlertCircle,
  Clock,
  FileSpreadsheet,
  FileImage,
  Zap
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

const AI_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4O Mini', description: 'Rápido e eficiente' },
  { id: 'gpt-4', name: 'GPT-4', description: 'Maior precisão' }
];

const OUTPUT_FORMATS = [
  { id: 'xlsx', name: 'Excel (XLSX)', icon: FileSpreadsheet },
  { id: 'csv', name: 'CSV', icon: FileText },
  { id: 'pdf', name: 'PDF', icon: FileText },
  { id: 'json', name: 'JSON', icon: FileText }
];

export default function DigitalizarPageComplete() {
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<DigitalizationFile[]>([]);
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [outputFormat, setOutputFormat] = useState('xlsx');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  // Carregar histórico de processamentos
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['/api/digitalizacao/history'],
    queryFn: () => fetch('/api/digitalizacao/history').then(res => res.json())
  });

  // Mutation para processar arquivos
  const processFilesMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/digitalizacao/process', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Falha no processamento');
      return response.json();
    },
    onSuccess: () => {
      setSelectedFiles([]);
      setProcessingProgress(0);
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/digitalizacao/history'] });
      toast({
        title: "Processamento concluído",
        description: "Arquivos processados com sucesso.",
      });
    },
    onError: () => {
      setIsProcessing(false);
      setProcessingProgress(0);
      toast({
        title: "Erro no processamento",
        description: "Falha ao processar os arquivos.",
        variant: "destructive",
      });
    }
  });

  // Mutation para deletar arquivo do histórico
  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/digitalizacao/delete/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Falha ao deletar');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/digitalizacao/history'] });
      toast({
        title: "Arquivo removido",
        description: "Arquivo removido do histórico.",
      });
    }
  });

  // Handlers para drag & drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Formato inválido",
          description: `${file.name} não é um formato suportado.`,
          variant: "destructive",
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede o limite de 10MB.`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });

    const newFiles = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      file
    }));

    setSelectedFiles(prev => [...prev, ...newFiles].slice(0, 20));
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== id));
  };

  const processFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(10);

    const formData = new FormData();
    formData.append('aiModel', aiModel);
    formData.append('outputFormat', outputFormat);
    formData.append('customPrompt', customPrompt);

    selectedFiles.forEach((file, index) => {
      formData.append('files', (file as any).file);
    });

    // Simular progresso
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 1000);

    processFilesMutation.mutate(formData);
  };

  const downloadFile = (id: string) => {
    window.open(`/api/digitalizacao/download/${id}`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Digitalização Inteligente</h1>
        <p className="text-gray-600 mt-2">
          Converta fichas odontológicas físicas em dados estruturados usando OCR + IA
        </p>
      </div>

      {/* Upload de Arquivos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Fichas
          </CardTitle>
          <CardDescription>
            Arraste arquivos aqui ou clique para selecionar. Suporte: JPG, PNG, TIFF (máx. 10MB cada, até 20 arquivos)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <FileImage className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">
              Arraste fichas digitalizadas aqui
            </p>
            <p className="text-gray-500 mb-4">
              ou clique para selecionar arquivos
            </p>
            <Input
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/tiff"
              onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
              className="hidden"
              id="file-upload"
            />
            <Label htmlFor="file-upload">
              <Button variant="outline" className="cursor-pointer">
                Selecionar Arquivos
              </Button>
            </Label>
          </div>

          {/* Lista de Arquivos Selecionados */}
          {selectedFiles.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Arquivos Selecionados ({selectedFiles.length})</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFiles([])}
                >
                  Limpar Todos
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileImage className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurações de Processamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Configurações de IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ai-model">Modelo de IA</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-sm text-gray-500">{model.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="output-format">Formato de Saída</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_FORMATS.map((format) => (
                    <SelectItem key={format.id} value={format.id}>
                      <div className="flex items-center gap-2">
                        <format.icon className="h-4 w-4" />
                        {format.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="custom-prompt">Prompt Personalizado (Opcional)</Label>
            <Textarea
              id="custom-prompt"
              placeholder="Ex: Extraia especialmente informações sobre procedimentos ortodônticos e valores..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-4">
            <Button
              onClick={processFiles}
              disabled={selectedFiles.length === 0 || isProcessing}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Processar com IA
            </Button>
            
            {isProcessing && (
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Processando...</span>
                </div>
                <Progress value={processingProgress} className="w-full" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Processamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Processamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando histórico...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Nenhum arquivo processado ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record: ProcessingHistory) => (
                <div key={record.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {record.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {record.status === 'processing' && <Clock className="h-5 w-5 text-blue-500" />}
                      {record.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                    </div>
                    <div>
                      <p className="font-medium">{record.filename}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{new Date(record.createdAt).toLocaleDateString('pt-BR')}</span>
                        <Badge variant="secondary">{record.format.toUpperCase()}</Badge>
                        <span>{record.recordCount} registros</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {record.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(record.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteFileMutation.mutate(record.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

