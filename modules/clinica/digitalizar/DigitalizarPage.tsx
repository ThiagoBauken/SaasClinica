
import React from 'react';

export default function DigitalizarPage() {
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
        📷 Digitalizar Fichas Odontológicas
      </h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Transforme fichas em papel em dados digitais usando inteligência artificial
      </p>
      
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Upload de Fichas</h2>
        
        <div style={{
          border: '2px dashed #3b82f6',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📁</div>
          <p style={{ marginBottom: '10px' }}>Arraste arquivos aqui ou clique para selecionar</p>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
            Formatos: JPG, PNG, TIFF (máximo 20 arquivos)
          </p>
          
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.tiff"
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          />
        </div>
        
        <button
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            marginTop: '15px'
          }}
          onClick={() => alert('Processamento ativado!')}
        >
          ⚡ Processar com IA
        </button>
      </div>
      
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Histórico de Processamentos</h2>
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#666',
          backgroundColor: '#f9fafb',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📄</div>
          <p>Nenhum arquivo processado ainda</p>
          <p style={{ fontSize: '14px', marginTop: '5px' }}>
            Faça upload das suas primeiras fichas acima
          </p>
        </div>
      </div>
    </div>
  );
}
