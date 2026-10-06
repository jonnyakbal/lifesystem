// Client errors carry their real message; server errors arrive redacted with
// only a digest that matches the server log. Either way the error screen (and
// any screenshot of it) names what failed instead of a generic sentence.
export function errorDetail(error: Error & { digest?: string }) {
  if (error.digest) return `Código do servidor: ${error.digest}`;
  return `${error.name || 'Erro'}: ${(error.message || 'sem mensagem').slice(0, 240)}`;
}
