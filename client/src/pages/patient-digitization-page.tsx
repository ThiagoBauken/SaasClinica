import { useState, useCallback } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Upload, FileImage, Loader2, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ExtractedPatient {
  name: string;
  phone?: string;
  email?: string;
  cpf?: string;
  dateOfBirth?: string;
  address?: string;
  status: "processing" | "success" | "error";
  error?: string;
}

interface FileWithPreview extends File {
  preview?: string;
}

export default function PatientDigitizationPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedPatients, setExtractedPatients] = useState<ExtractedPatient[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [aiModel, setAiModel] = useState("deepseek-chat");
  const [outputFormat, setOutputFormat] = useState("database");

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
    const imageFiles = droppedFiles.filter(file =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length !== droppedFiles.length) {
      toast({
        title: "Aviso",
        description: "Apenas arquivos de imagem são aceitos",
        variant: "destructive",
      });
    }

    const filesWithPreview = imageFiles.map(file => {
      const fileWithPreview = file as FileWithPreview;
      fileWithPreview.preview = URL.createObjectURL(file);
      return fileWithPreview;
    });

    setFiles(prev => [...prev, ...filesWithPreview]);
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);
    const filesWithPreview = selectedFiles.map(file => {
      const fileWithPreview = file as FileWithPreview;
      fileWithPreview.preview = URL.createObjectURL(file);
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

  const processImages = async () => {
    if (files.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma imagem",
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
    formData.append('customPrompt', customPrompt);
    formData.append('aiModel', aiModel);
    formData.append('outputFormat', outputFormat);
    formData.append('companyId', user?.companyId?.toString() || '');

    try {
      const response = await fetch('/api/v1/patients/digitize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erro ao processar imagens');
      }

      const data = await response.json();

      setExtractedPatients(data.patients || []);
      setProgress(100);

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

  return (
    <DashboardLayout title="Digitalização de Prontuários" currentPath="/pacientes/digitalizar">
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Digitalização de Prontuários</h1>
          <p className="text-muted-foreground">
            Faça upload de fotos de fichas de pacientes para digitalização automática
          </p>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload de Imagens</CardTitle>
            <CardDescription>
              Arraste e solte imagens ou clique para selecionar
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
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste imagens aqui ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPG, JPEG, TIFF
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
                        {file.preview && (
                          <img
                            src={file.preview}
                            alt={file.name}
                            className="h-10 w-10 object-cover rounded"
                          />
                        )}
                        <FileImage className="h-4 w-4" />
                        <span className="text-sm truncate max-w-[200px]">
                          {file.name}
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
              Configure o processamento das imagens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-model">Modelo de IA</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger id="ai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek-chat">DeepSeek Chat (Rápido e Econômico)</SelectItem>
                  <SelectItem value="deepseek-reasoner">DeepSeek Reasoner (Mais Preciso)</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-prompt">Prompt Personalizado (Opcional)</Label>
              <Textarea
                id="custom-prompt"
                placeholder="Ex: Extrair também informações de endereço e convênio"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
              />
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
                  Processar Imagens
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
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{patient.name}</h3>
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </DashboardLayout>
  );
}
