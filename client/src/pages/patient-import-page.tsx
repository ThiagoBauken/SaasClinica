import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCsrfHeaders } from '@/lib/csrf';

/**
 * Página de Importação de Pacientes
 * Suporta importação via:
 * - Imagens de fichas físicas (OCR + AI)
 * - Arquivos XLSX/CSV
 */

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
  patients: any[];
  billing?: {
    unitsUsed: number;
    cost: number; // em centavos
    currentCycleTotal: number;
    estimatedCost: number; // em centavos
    alert?: { level: 'warning' | 'critical'; message: string };
  };
}

export default function PatientImportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'images' | 'xlsx'>('images');

  // Estado para upload de imagens
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagesPreviews, setImagesPreviews] = useState<string[]>([]);

  // Estado para upload de XLSX
  const [selectedXlsx, setSelectedXlsx] = useState<File | null>(null);

  // Estado de processamento
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Configurações de merge
  const [prioritizeExisting, setPrioritizeExisting] = useState(true);
  const [overwriteEmpty, setOverwriteEmpty] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(false);

  /**
   * Manipula seleção de imagens
   */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length > 50) {
      toast({
        title: 'Limite excedido',
        description: 'Máximo de 50 imagens por vez',
        variant: 'destructive',
      });
      return;
    }

    setSelectedImages(files);

    // Gera previews
    const previews = files.map(file => URL.createObjectURL(file));
    setImagesPreviews(previews);
  };

  /**
   * Manipula seleção de arquivo XLSX
   */
  const handleXlsxSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedXlsx(file);
    }
  };

  /**
   * Processa importação de imagens
   */
  const handleImportImages = async () => {
    if (selectedImages.length === 0) {
      toast({
        title: 'Nenhuma imagem selecionada',
        description: 'Selecione pelo menos uma imagem para importar',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const formData = new FormData();
      selectedImages.forEach(file => {
        formData.append('images', file);
      });
      formData.append('prioritizeExisting', prioritizeExisting.toString());
      formData.append('overwriteEmpty', overwriteEmpty.toString());
      formData.append('skipDuplicates', skipDuplicates.toString());

      const response = await fetch('/api/v1/patients/import/images', {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Erro ao processar importação');
      }

      const data = await response.json();
      setResult(data.result);

      toast({
        title: 'Importação concluída!',
        description: `${data.result.success} pacientes importados com sucesso`,
      });

      // Limpa seleção
      setSelectedImages([]);
      setImagesPreviews([]);
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  /**
   * Processa importação de XLSX
   */
  const handleImportXlsx = async () => {
    if (!selectedXlsx) {
      toast({
        title: 'Nenhum arquivo selecionado',
        description: 'Selecione um arquivo XLSX para importar',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedXlsx);
      formData.append('prioritizeExisting', prioritizeExisting.toString());
      formData.append('overwriteEmpty', overwriteEmpty.toString());
      formData.append('skipDuplicates', skipDuplicates.toString());

      const response = await fetch('/api/v1/patients/import/xlsx', {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Erro ao processar importação');
      }

      const data = await response.json();
      setResult(data.result);

      toast({
        title: 'Importação concluída!',
        description: `${data.result.success} pacientes importados com sucesso`,
      });

      // Limpa seleção
      setSelectedXlsx(null);
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  /**
   * Baixa template XLSX
   */
  const handleDownloadTemplate = () => {
    // Template simples em formato CSV
    const template = `Nome,Telefone,Celular,Email,CPF,Data de Nascimento,Endereço,Cidade,Estado,CEP,Bairro
João Silva,(11) 3333-4444,(11) 99999-8888,joao@email.com,123.456.789-00,15/06/1985,Rua Principal 123,São Paulo,SP,01234-567,Centro
Maria Santos,(11) 3333-5555,(11) 98888-7777,maria@email.com,987.654.321-00,20/03/1990,Av. Secundária 456,São Paulo,SP,01234-890,Jardins`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template-pacientes.csv';
    link.click();
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Importação de Pacientes</h1>
        <p className="text-muted-foreground mt-2">
          Importe pacientes de fichas físicas (fotos) ou arquivos Excel
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="images" className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Fichas Físicas (Fotos)
          </TabsTrigger>
          <TabsTrigger value="xlsx" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Arquivo Excel
          </TabsTrigger>
        </TabsList>

        {/* Tab: Importação de Imagens */}
        <TabsContent value="images" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Digitalizar Fichas Físicas</CardTitle>
              <CardDescription>
                Faça upload de fotos das fichas de pacientes. O sistema usará OCR e Inteligência Artificial
                para extrair automaticamente os dados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="image-upload"
                  multiple
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">
                    Clique para selecionar ou arraste fotos aqui
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    PNG, JPG, JPEG, TIFF (máx. 50 imagens, 20MB cada)
                  </p>
                </label>
              </div>

              {selectedImages.length > 0 && (
                <div>
                  <p className="font-medium mb-2">
                    {selectedImages.length} imagem(ns) selecionada(s)
                  </p>
                  <div className="grid grid-cols-4 gap-4">
                    {imagesPreviews.map((preview, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-32 object-cover rounded border"
                        />
                        <span className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                          {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleImportImages}
                disabled={isProcessing || selectedImages.length === 0}
                className="w-full"
              >
                {isProcessing ? 'Processando...' : `Importar ${selectedImages.length} Ficha(s)`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Importação de XLSX */}
        <TabsContent value="xlsx" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar de Planilha Excel</CardTitle>
              <CardDescription>
                Faça upload de um arquivo XLSX ou CSV com os dados dos pacientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Download className="h-4 w-4" />
                <AlertDescription>
                  <button
                    onClick={handleDownloadTemplate}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Baixe o template Excel
                  </button>
                  {' '}para garantir que os campos estão corretos
                </AlertDescription>
              </Alert>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="xlsx-upload"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleXlsxSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
                <label htmlFor="xlsx-upload" className="cursor-pointer">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">
                    Clique para selecionar arquivo
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    XLSX, XLS ou CSV
                  </p>
                </label>
              </div>

              {selectedXlsx && (
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    Arquivo selecionado: <strong>{selectedXlsx.name}</strong>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleImportXlsx}
                disabled={isProcessing || !selectedXlsx}
                className="w-full"
              >
                {isProcessing ? 'Processando...' : 'Importar Planilha'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configurações de Merge */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Configurações de Importação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={prioritizeExisting}
              onChange={(e) => setPrioritizeExisting(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              Priorizar dados existentes (manter informações já cadastradas)
            </span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={overwriteEmpty}
              onChange={(e) => setOverwriteEmpty(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              Preencher campos vazios com dados importados
            </span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              Pular pacientes duplicados (não atualizar)
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Progress e Resultado */}
      {isProcessing && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <Progress value={progress} className="mb-2" />
            <p className="text-sm text-center text-muted-foreground">
              Processando...
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Resultado da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2 p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{result.success}</p>
                  <p className="text-sm text-green-700">Importados</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 p-4 bg-red-50 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                  <p className="text-sm text-red-700">Falharam</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 p-4 bg-yellow-50 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                  <p className="text-sm text-yellow-700">Ignorados</p>
                </div>
              </div>
            </div>

            {/* Informações de Billing */}
            {result.billing && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">💰 Custo da Digitalização</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Fichas digitalizadas:</span>
                    <span className="ml-2 font-bold">{result.billing.unitsUsed}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Custo desta importação:</span>
                    <span className="ml-2 font-bold text-green-600">
                      R$ {(result.billing.cost / 100).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Total do mês:</span>
                    <span className="ml-2 font-bold">{result.billing.currentCycleTotal} fichas</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Custo estimado mensal:</span>
                    <span className="ml-2 font-bold">
                      R$ {(result.billing.estimatedCost / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-blue-600">
                  Preço: R$ 30,00 por 1.000 fichas digitalizadas
                </p>
              </div>
            )}

            {/* Alertas de Uso */}
            {result.billing?.alert && (
              <Alert variant={result.billing.alert.level === 'critical' ? 'destructive' : 'default'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{result.billing.alert.level === 'critical' ? 'ATENÇÃO:' : 'Aviso:'}</strong>{' '}
                  {result.billing.alert.message}
                </AlertDescription>
              </Alert>
            )}

            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Erros encontrados:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {result.errors.slice(0, 10).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li>... e mais {result.errors.length - 10} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
