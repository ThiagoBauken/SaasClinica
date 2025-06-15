function DigitalizacaoBasica() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
          📷 Digitalização de Registros
        </h1>
        <p style={{ color: '#6b7280', fontSize: '18px' }}>
          Extraia dados de fichas odontológicas usando IA
        </p>
      </div>

      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
        padding: '32px',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>
          Upload de Fichas Odontológicas
        </h2>
        
        <div style={{
          border: '2px dashed #3b82f6',
          borderRadius: '12px',
          padding: '48px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          cursor: 'pointer'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📁</div>
          <h3 style={{ fontSize: '20px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            Selecione as fichas odontológicas
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Arraste e solte ou clique para selecionar
          </p>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>
            Formatos aceitos: JPG, PNG, TIFF (máximo 20 arquivos)
          </p>
          
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.tiff"
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500'
            }}
          />
        </div>
        
        <div style={{ marginTop: '32px' }}>
          <button
            style={{
              width: '100%',
              padding: '16px 24px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            onClick={() => alert('Funcionalidade de processamento ativada!')}
          >
            ⚡ Processar com IA
          </button>
        </div>
      </div>

      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
        padding: '32px'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>
          📋 Histórico de Processamentos
        </h2>
        <div style={{ 
          textAlign: 'center', 
          padding: '48px 24px', 
          color: '#6b7280',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
          <p>Nenhum arquivo processado ainda</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Faça upload e processe seus primeiros arquivos acima
          </p>
        </div>
      </div>
    </div>
  );
}

export default DigitalizacaoBasica;