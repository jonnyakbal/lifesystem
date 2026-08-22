export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || `Erro ${res.status}`);
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
