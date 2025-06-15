export default function DigitalizarPageSimple() {
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📷 Digitalizar Fichas Odontológicas
        </h1>
        <p className="text-gray-600 mb-8">
          Transforme fichas em papel em dados digitais usando inteligência artificial
        </p>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Upload de Fichas</h2>
          
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50 hover:bg-blue-100 transition-colors">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Arraste arquivos aqui ou clique para selecionar
            </h3>
            <p className="text-gray-500 mb-4">
              Formatos aceitos: JPG, PNG, TIFF (máximo 20 arquivos)
            </p>
            
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.tiff"
              className="mb-4"
            />
          </div>
          
          <button className="w-full mt-4 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors">
            ⚡ Processar com IA
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Histórico de Processamentos</h2>
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-lg font-medium mb-2">Nenhum arquivo processado</h3>
            <p className="text-sm">Faça upload das suas primeiras fichas para começar</p>
          </div>
        </div>
      </div>
    </div>
  );
}