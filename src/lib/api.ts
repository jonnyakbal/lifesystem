export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || `Erro ${res.status}`);
    }
    // Mutações de capturas/tarefas mudam a fila do INBOX — avisa os contadores
    // da navegação (nav-counts.tsx) numa única fonte, em vez de cada tela
    // conhecer a sidebar. GET e endpoints de outros domínios não disparam.
    const method = (options?.method || 'GET').toUpperCase();
    if (typeof window !== 'undefined' && method !== 'GET' && /^\/api\/(captures|tasks)/.test(url)) {
      window.dispatchEvent(new Event('ls:counts:dirty'));
    }
    return res.json();
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Falha na conexão');
  }
}

export function showError(err: unknown) {
  return err instanceof Error ? err.message : 'Erro desconhecido';
}
