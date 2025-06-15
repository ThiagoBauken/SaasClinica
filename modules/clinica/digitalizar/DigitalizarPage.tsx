export default function DigitalizarPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📷 Digitalizar Fichas
        </h1>
        <p className="text-gray-600">
          Transforme fichas odontológicas em papel em dados digitais usando inteligência artificial
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            📤 Upload de Fichas
          </h2>
          
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Adicione suas fichas odontológicas
            </h3>
            <p className="text-gray-500 mb-4">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <p className="text-sm text-gray-400 mb-4">
              JPG, PNG, TIFF - Máximo 20 arquivos
            </p>
            
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.tiff"
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Selecionar Arquivos
            </label>
          </div>

          <div className="mt-6">
            <button className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors">
              ⚡ Processar com IA
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            🎯 Como Funciona
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                1
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Upload das Fichas</h3>
                <p className="text-gray-600 text-sm">Envie fotos ou digitalizações das fichas odontológicas</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                2
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Processamento IA</h3>
                <p className="text-gray-600 text-sm">A inteligência artificial extrai textos e dados das imagens</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                3
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Dados Estruturados</h3>
                <p className="text-gray-600 text-sm">Receba os dados organizados em planilha Excel</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            📋 Histórico de Processamentos
          </h2>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            Ver Todos
          </button>
        </div>
        
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-lg font-medium mb-2">Nenhum arquivo processado</h3>
          <p className="text-sm">Faça upload das suas primeiras fichas para começar</p>
        </div>
      </div>
    </div>
  );
}