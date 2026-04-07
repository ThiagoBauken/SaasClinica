import { useState, useEffect } from 'react';

export interface ViaCepResult {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  complemento?: string;
  cep?: string;
}

/**
 * Hook for Brazilian CEP (postal code) lookup via the ViaCEP public API.
 *
 * Usage:
 *   const { data, loading, error } = useViaCep(cepValue);
 *
 * - cep: raw string (with or without mask — non-digits are stripped)
 * - data: populated once a valid 8-digit CEP is resolved
 * - loading: true while the request is in-flight
 * - error: human-readable Portuguese error message, or null
 *
 * The hook aborts any in-flight request when the cep value changes,
 * preventing stale responses from overwriting newer ones.
 */
export function useViaCep(cep: string | undefined) {
  const [data, setData] = useState<ViaCepResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cleanCep = cep?.replace(/\D/g, '');

    if (!cleanCep || cleanCep.length !== 8) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();

    fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Servico indisponivel');
        return res.json();
      })
      .then((result: ViaCepResult & { erro?: boolean }) => {
        if (result.erro) {
          setError('CEP nao encontrado');
          setData(null);
        } else {
          setData(result);
        }
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') {
          setError('Erro ao buscar CEP');
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [cep]);

  return { data, loading, error };
}
