import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../../../client/src/lib/queryClient';
import { Button } from '../../../client/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Input } from '../../../client/src/components/ui/input';
import { Label } from '../../../client/src/components/ui/label';
import { Textarea } from '../../../client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../client/src/components/ui/select';
import { Progress } from '../../../client/src/components/ui/progress';
import { useToast } from '../../../client/src/hooks/use-toast';
import { 
  Upload, 
  FileImage, 
  Download, 
  Trash2, 
  Bot,
  FileSpreadsheet,
  History,
  Zap,
  Scan
} from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  preview?: string;
}

interface ProcessingResult {
  id: string;
  filename: string;
  downloadUrl: string;
  processedAt: string;
  format: string;
  recordCount: number;
}

export default function DigitalizacaoPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [outputFormat, setOutputFormat] = useState('xlsx');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Query para buscar histórico de processamentos
  const { data: processHistory } = useQuery({
    queryKey: ['/api/digitalizacao/history'],
    enabled: true
  });

  // Mutation para processar arquivos
  const processFilesMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/digitalizacao/process', {
        method: 'POST',
        body: data
      });
      if (!response.ok) throw new Error('Falha no processamento');
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/digitalizacao/history'] });
      toast({
        title: "Processamento concluído",
        description: `${result.recordCount} registros extraídos com sucesso.`,
      });
      setUploadedFiles([]);
      setIsProcessing(false);
      setUploadProgress(0);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha no processamento dos arquivos.",
        variant: "destructive",
      });
      setIsProcessing(false);
      setUploadProgress(0);
    }
  });

  // Mutation para deletar arquivo do histórico
  const deleteFileMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await fetch(`/api/digitalizacao/delete/${filename}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Falha ao deletar');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/digitalizacao/history'] });
      toast({
        title: "Arquivo deletado",
        description: "Arquivo removido com sucesso.",
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff'];
    
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Arquivo inválido",
          description: `${file.name}: Apenas imagens JPG, PNG e TIFF são aceitas.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      preview: URL.createObjectURL(file)
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff'];
    
    const validFiles = files.filter(file => allowedTypes.includes(file.type));
    
    const newFiles: UploadedFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      preview: URL.createObjectURL(file)
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
  };

  const handleProcess = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um arquivo para processar.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);

    const formData = new FormData();
    
    // Adicionar arquivos ao FormData
    const fileInput = fileInputRef.current;
    if (fileInput?.files) {
      Array.from(fileInput.files).forEach(file => {
        formData.append('files', file);
      });
    }

    formData.append('customPrompt', customPrompt);
    formData.append('model', selectedModel);
    formData.append('format', outputFormat);

    // Simular progresso de upload
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    processFilesMutation.mutate(formData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Scan className="h-8 w-8 text-blue-600" />
            Digitalização de Registros
          </h1>
          <p className="text-gray-600">Extraia dados de fichas odontológicas usando IA</p>
        </div>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-500" />
          <span className="text-sm text-gray-600">Powered by OpenAI & Google Vision</span>
        </div>
      </div>

      {/* Configurações de Processamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Configurações de Processamento
          </CardTitle>
          <CardDescription>
            Configure como a IA deve processar os registros odontológicos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="model">Modelo de IA</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido)</SelectItem>
                  <SelectItem value="gpt-4">GPT-4 (Preciso)</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Econômico)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="format">Formato de Saída</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="customPrompt">Prompt Personalizado (Opcional)</Label>
            <Textarea
              id="customPrompt"
              placeholder="Instrução específica para a IA extrair dados adicionais..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Área de Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Imagens
          </CardTitle>
          <CardDescription>
            Arraste e solte ou clique para selecionar fichas odontológicas (JPG, PNG, TIFF)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileImage className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg text-gray-600 mb-2">
              Arraste imagens aqui ou clique para selecionar
            </p>
            <p className="text-sm text-gray-500">
              Suporte: JPG, PNG, TIFF • Múltiplos arquivos aceitos
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Lista de Arquivos */}
          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Arquivos Selecionados ({uploadedFiles.length})
                </h3>
                <Button variant="outline" size="sm" onClick={clearAllFiles}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Todos
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {file.preview && (
                      <img 
                        src={file.preview} 
                        alt={file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progresso de Upload */}
          {isProcessing && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Processando com IA...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button 
              onClick={handleProcess}
              disabled={uploadedFiles.length === 0 || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Bot className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Processar com IA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Processamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Processamentos
          </CardTitle>
          <CardDescription>
            Arquivos processados anteriormente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processHistory && processHistory.length > 0 ? (
            <div className="space-y-3">
              {processHistory.map((item: ProcessingResult) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="font-medium">{item.filename}</p>
                      <p className="text-sm text-gray-500">
                        {item.recordCount} registros • {formatDate(item.processedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={item.downloadUrl} download>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFileMutation.mutate(item.filename)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum arquivo processado ainda</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}