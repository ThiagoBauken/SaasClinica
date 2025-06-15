import React, { useState, useRef } from 'react';

export default function DigitalizacaoPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      alert('Selecione pelo menos um arquivo');
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('model', 'gpt-4o-mini');
    formData.append('format', 'xlsx');

    try {
      const response = await fetch('/api/digitalizacao/process', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        alert('Processamento concluído com sucesso!');
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        alert('Erro no processamento');
      }
    } catch (error) {
      alert('Erro na requisição');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📷 Digitalização de Registros Odontológicos
        </h1>
        <p className="text-gray-600">
          Faça upload de fichas odontológicas em imagem e extraia os dados automaticamente usando IA
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload de Arquivos</h2>
        
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50 hover:bg-blue-100 transition-colors">
          <div className="mb-4">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Selecione as fichas odontológicas
            </h3>
            <p className="text-gray-500 mb-4">
              Aceitos: JPG, PNG, TIFF (máximo 20 arquivos)
            </p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.tiff"
            onChange={handleFileChange}
            className="mb-4"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Escolher Arquivos
          </button>
        </div>

        {files.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium mb-3">
              ✅ {files.length} arquivo{files.length !== 1 ? 's' : ''} selecionado{files.length !== 1 ? 's' : ''}:
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-50 p-3 rounded">
              {files.map((file, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleProcess}
            disabled={files.length === 0 || isProcessing}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
              files.length === 0 || isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isProcessing ? '🤖 Processando com IA...' : `⚡ Processar ${files.length} arquivo${files.length !== 1 ? 's' : ''} com IA`}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">📋 Histórico de Processamentos</h2>
        <p className="text-gray-500 text-center py-8">
          Nenhum arquivo processado ainda. Faça upload e processe seus primeiros arquivos acima.
        </p>
      </div>
    </div>
  );
}