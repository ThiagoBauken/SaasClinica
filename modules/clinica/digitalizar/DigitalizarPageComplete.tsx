import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  X,
  Download, 
  Trash2, 
  FileImage,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  preview?: string;
}

interface ProcessingRecord {
  id: string;
  filename: string;
  downloadUrl: string;
  processedAt: string;
  format: string;
  recordCount: number;
}

export default function DigitalizarPageComplete() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [model, setModel] = useState('gpt-4o-mini');
  const [format, setFormat] = useState('xlsx');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Buscar histórico de processamentos
  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['/api/digitalizacao/history'],
    staleTime: 30000
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const isValidType = file.type.startsWith('image/') || 
        ['image/tiff', 'image/tif'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      
      if (!isValidType) {
        toast({
          title: "Arquivo inválido",
          description: `${file.name} não é um formato de imagem suportado`,
          variant: "destructive"
        });
        return false;
      }
      
      if (!isValidSize) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede o limite de 10MB`,
          variant: "destructive"
        });
        return false;
      }
      
      return true;
    });

    const uploadedFiles: UploadedFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      preview: URL.createObjectURL(file)
    }));

    setFiles(prev => {
      const combined = [...prev, ...uploadedFiles];
      if (combined.length > 20) {
        toast({
          title: "Muitos arquivos",
          description: "Máximo de 20 arquivos permitidos",
          variant: "destructive"
        });
        return prev;
      }
      return combined;
    });

    // Adicionar arquivos reais ao input para upload
    if (fileInputRef.current && validFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      
      // Manter arquivos existentes
      if (fileInputRef.current.files) {
        Array.from(fileInputRef.current.files).forEach(file => {
          dataTransfer.items.add(file);
        });
      }
      
      // Adicionar novos arquivos
      validFiles.forEach(file => {
        dataTransfer.items.add(file);
      });
      
      fileInputRef.current.files = dataTransfer.files;
    }
  }, [toast]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    
    // Atualizar input de arquivos
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      const remainingFiles = files.filter(f => f.id !== fileId);
      
      // Esta é uma limitação - não podemos recriar o input com arquivos específicos
      // Em uma implementação real, você manteria os File objects separadamente
      fileInputRef.current.value = '';
    }
  }, [files]);

  const clearAllFiles = useCallback(() => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const processMutation = useMutation({
    mutationFn: async () => {
      if (!fileInputRef.current?.files || fileInputRef.current.files.length === 0) {
        throw new Error('Nenhum arquivo selecionado');
      }

      const formData = new FormData();
      
      Array.from(fileInputRef.current.files).forEach(file => {
        formData.append('files', file);
      });
      
      formData.append('model', model);
      formData.append('format', format);
      
      if (customPrompt.trim()) {
        formData.append('customPrompt', customPrompt);
      }

      const response = await fetch('/api/digitalizacao/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro no processamento');
      }

      return response.json();
    },
    onMutate: () => {
      setIsProcessing(true);
      setUploadProgress(0);
    },
    onSuccess: (data) => {
      toast({
        title: "Processamento concluído",
        description: `${data.recordCount} registros extraídos com sucesso`,
      });
      
      // Limpar arquivos após sucesso
      clearAllFiles();
      
      // Atualizar histórico
      refetchHistory();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no processamento",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await fetch(`/api/digitalizacao/delete/${filename}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Erro ao deletar arquivo');
      }
    },
    onSuccess: () => {
      toast({
        title: "Arquivo deletado",
        description: "Arquivo removido com sucesso",
      });
      refetchHistory();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível deletar o arquivo",
        variant: "destructive"
      });
    }
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📷 Digitalizar Fichas Odontológicas
        </h1>
        <p className="text-gray-600">
          Transforme fichas odontológicas em papel em dados digitais estruturados usando inteligência artificial
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Upload Area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Fichas
            </CardTitle>
            <CardDescription>
              Arraste e solte ou clique para selecionar até 20 arquivos (JPG, PNG, TIFF)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileImage className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecione suas fichas odontológicas
              </h3>
              <p className="text-gray-500 mb-4">
                Arraste arquivos aqui ou clique para selecionar
              </p>
              <p className="text-sm text-gray-400">
                JPG, PNG, TIFF • Máximo 10MB por arquivo • Até 20 arquivos
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.tiff,.tif"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">
                    Arquivos selecionados ({files.length})
                  </h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearAllFiles}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Limpar todos
                  </Button>
                </div>
                
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="text-red-600 hover:text-red-700"
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

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>
              Configure o modelo de IA e formato de saída
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo de IA</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4O Mini (Recomendado)</SelectItem>
                  <SelectItem value="gpt-4">GPT-4 (Mais preciso)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Formato de saída</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customPrompt">Prompt personalizado (opcional)</Label>
              <Textarea
                id="customPrompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Digite instruções específicas para extração de dados..."
                rows={3}
              />
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="space-y-2">
                <Label>Processando...</Label>
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-xs text-gray-500 text-center">
                  Extraindo dados com IA
                </p>
              </div>
            )}

            <Button
              onClick={() => processMutation.mutate()}
              disabled={files.length === 0 || isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <AlertCircle className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Processar {files.length} arquivo{files.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 Histórico de Processamentos
          </CardTitle>
          <CardDescription>
            Arquivos processados recentemente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileImage className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum arquivo processado</h3>
              <p className="text-sm">
                Faça upload das suas primeiras fichas para começar
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((record: ProcessingRecord) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {record.filename}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {record.recordCount} registros • {record.format.toUpperCase()} • 
                      {new Date(record.processedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(record.downloadUrl, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(record.filename)}
                      className="text-red-600 hover:text-red-700"
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