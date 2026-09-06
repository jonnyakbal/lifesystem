// Fetching arbitrary web pages server-side, shared by the edital analysis
// and discovery routes. A browser User-Agent is required: several of the
// Brazilian culture sites return 403 to a default fetch agent.

export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Link inválido.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Só aceito links http/https.');
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '::1' ||
    host === '[::1]';
  if (isPrivate) {
    throw new Error('Esse link aponta pra rede interna.');
  }
  return url;
}

export async function fetchPageText(url: URL): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) {
    throw new Error(`A página respondeu ${res.status}.`);
  }
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
