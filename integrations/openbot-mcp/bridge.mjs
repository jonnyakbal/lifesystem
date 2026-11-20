import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const upstream = 'https://lifesystem.oj0nny.com/api/mcp';
const maxRequestBytes = 2 * 1024 * 1024;
const requestHeaders = ['accept', 'content-type', 'mcp-protocol-version', 'mcp-session-id', 'last-event-id'];
const responseHeaders = ['content-type', 'mcp-protocol-version', 'mcp-session-id', 'retry-after', 'allow'];

function sendError(response, status, message) {
  if (response.destroyed) return;
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify({ error: message }));
}

async function readBody(request) {
  let length = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > maxRequestBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

export function createBridge({ token, fetchUpstream = fetch, enrollment = true }) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
    throw new Error('O segredo MCP precisa ser uma chave aleatória em base64url.');
  }
  return createServer(async (request, response) => {
    if (!/^127\.0\.0\.1(?::\d{1,5})?$/.test(request.headers.host ?? '') || request.headers.origin !== undefined) {
      sendError(response, 403, 'A ponte aceita apenas clientes locais.');
      return;
    }
    if (request.url !== '/mcp') {
      sendError(response, 404, 'Rota indisponível.');
      return;
    }
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
      response.setHeader('allow', 'GET, POST, DELETE');
      sendError(response, 405, 'Método não permitido.');
      return;
    }

    const clientEnded = new AbortController();
    response.once('close', () => clientEnded.abort());
    try {
      const body = request.method === 'POST' ? await readBody(request) : undefined;
      if (body === null) {
        response.setHeader('connection', 'close');
        sendError(response, 413, 'Solicitação grande demais.');
        return;
      }

      if (enrollment && body) {
        let message;
        try { message = JSON.parse(body.toString('utf8')); } catch {
          sendError(response, 400, 'Solicitação MCP inválida.');
          return;
        }
        if (!['initialize', 'notifications/initialized', 'ping', 'tools/list'].includes(message?.method)) {
          sendError(response, 403, 'A ponte está em modo de cadastro. Chamadas de ferramentas estão bloqueadas.');
          return;
        }
      }

      const headers = new Headers({ authorization: 'Bearer ' + token });
      for (const name of requestHeaders) {
        const value = request.headers[name];
        if (typeof value === 'string') headers.set(name, value);
      }

      const reply = await fetchUpstream(upstream, {
        method: request.method, headers, body, redirect: 'manual',
        signal: AbortSignal.any([clientEnded.signal, AbortSignal.timeout(60_000)]),
      });
      if (reply.status >= 300 && reply.status < 400) {
        await reply.body?.cancel();
        sendError(response, 502, 'O endpoint MCP retornou um redirecionamento.');
        return;
      }
      const output = { 'cache-control': 'no-store' };
      for (const name of responseHeaders) {
        const value = reply.headers.get(name);
        if (value) output[name] = value;
      }
      response.writeHead(reply.status, output);
      if (reply.body) await pipeline(Readable.fromWeb(reply.body), response);
      else response.end();
    } catch {
      sendError(response, 502, 'A ponte não conseguiu consultar o LifeSystem.');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const token = (await readFile('/run/secrets/lifesystem-mcp', 'utf8')).trim();
    const server = createBridge({ token, enrollment: process.env.LIFESYSTEM_BRIDGE_ENROLLMENT !== '0' });
    server.on('error', () => {
      console.error('A ponte MCP não conseguiu iniciar.');
      process.exitCode = 1;
    });
    server.listen(4193, '127.0.0.1');
  } catch {
    console.error('A ponte MCP não conseguiu carregar seu segredo.');
    process.exitCode = 1;
  }
}
