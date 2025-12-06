import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Hook para debounce de valores
 * Útil para inputs de busca, filtros, etc.
 *
 * @param value - Valor a ser debounced
 * @param delay - Delay em ms (padrão: 500ms)
 * @returns Valor debounced
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 *
 * useEffect(() => {
 *   // Fazer busca com debouncedSearchTerm
 * }, [debouncedSearchTerm]);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Atualizar debounced value após o delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancelar timeout se value mudar (cleanup)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para debounce de callbacks/funções
 * Útil para event handlers, API calls, etc.
 *
 * @param callback - Função a ser debounced
 * @param delay - Delay em ms (padrão: 500ms)
 * @returns Função debounced
 *
 * @example
 * const handleSearch = useDebouncedCallback((term: string) => {
 *   // Fazer busca
 * }, 500);
 *
 * <input onChange={(e) => handleSearch(e.target.value)} />
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Cleanup ao desmontar
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * Hook para throttle de valores
 * Limita a frequência de atualizações
 *
 * @param value - Valor a ser throttled
 * @param limit - Intervalo mínimo em ms (padrão: 500ms)
 * @returns Valor throttled
 *
 * @example
 * const [scrollPosition, setScrollPosition] = useState(0);
 * const throttledPosition = useThrottle(scrollPosition, 100);
 */
export function useThrottle<T>(value: T, limit: number = 500): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

/**
 * Hook para throttle de callbacks
 * Limita a frequência de execução de funções
 *
 * @param callback - Função a ser throttled
 * @param limit - Intervalo mínimo em ms (padrão: 500ms)
 * @returns Função throttled
 *
 * @example
 * const handleScroll = useThrottledCallback(() => {
 *   console.log('Scroll position:', window.scrollY);
 * }, 100);
 *
 * window.addEventListener('scroll', handleScroll);
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 500
): (...args: Parameters<T>) => void {
  const inThrottle = useRef(false);

  return useCallback(
    (...args: Parameters<T>) => {
      if (!inThrottle.current) {
        callback(...args);
        inThrottle.current = true;

        setTimeout(() => {
          inThrottle.current = false;
        }, limit);
      }
    },
    [callback, limit]
  );
}

/**
 * Utility function pura para debounce (não é hook)
 * Útil para usar fora de componentes React
 *
 * @param func - Função a ser debounced
 * @param delay - Delay em ms
 * @returns Função debounced
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Utility function pura para throttle (não é hook)
 *
 * @param func - Função a ser throttled
 * @param limit - Intervalo mínimo em ms
 * @returns Função throttled
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number = 500
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
