// Fetching arbitrary web pages server-side, shared by the edital analysis
// and discovery routes. A browser User-Agent is required: several of the
// Brazilian culture sites return 403 to a default fetch agent.

const MAX_BYTES = 5_000_000;

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

  // Editais are often linked as PDFs. Those pass res.ok, survive tag
  // stripping as binary noise, and then cost a full model call to produce
  // nothing — so reject by content type before reading the body.
  const tipo = res.headers.get('content-type') || '';
  if (tipo && !/text\/html|text\/plain|application\/xhtml/i.test(tipo)) {
    throw new Error(`Essa URL não é uma página de texto (${tipo.split(';')[0]}).`);
  }

  // Cap the read: the body is fully buffered before any truncation happens,
  // so without this a large file would sit in memory on a shared host.
  const declarado = Number(res.headers.get('content-length') || 0);
  if (declarado > MAX_BYTES) {
    throw new Error('Essa página é grande demais pra ler.');
  }
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('Essa página é grande demais pra ler.');
  }
  const html = new TextDecoder('utf-8').decode(buffer);
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
