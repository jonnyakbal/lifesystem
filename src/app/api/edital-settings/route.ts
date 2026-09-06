// Single-document settings for the Editais automation cockpit. GET seeds
// defaults on first read so the UI never has to handle a missing config.
import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { EditalSettings } from '@/types';

const DEFAULTS = {
  perfil:
    'Produtor cultural, DJ e empreendedor em Santa Maria/RS. Atua com música, cultura de rua, eventos, formação e gestão de espaço cultural.',
  preRequisitos:
    'Sem CNPJ próprio para alguns editais. Residente no RS. Priorizar editais que aceitem pessoa física ou MEI.',
  palavrasChave: ['edital cultural', 'fomento à cultura', 'música', 'Rio Grande do Sul', 'cultura de rua'],
  // Verified server-rendered and readable without JS. Most culture sites are
  // SPAs whose listings never reach the HTML, so this list is a starting
  // point to curate — a page that renders its editais client-side will
  // silently come back empty no matter how good the prompt is.
  fontes: [
    'https://www.santamaria.rs.gov.br/editais',
    'https://www.gov.br/cultura/pt-br/assuntos/editais',
  ],
  notaMinima: 6,
};

async function findSettings() {
  const all = await storage.getAll<EditalSettings>('edital-settings');
  return all[0] || null;
}

export async function GET() {
  let settings = await findSettings();
  if (!settings) {
    settings = await storage.create<EditalSettings>('edital-settings', DEFAULTS);
  }
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const patch = {
    perfil: typeof body.perfil === 'string' ? body.perfil : DEFAULTS.perfil,
    preRequisitos: typeof body.preRequisitos === 'string' ? body.preRequisitos : '',
    palavrasChave: Array.isArray(body.palavrasChave) ? body.palavrasChave : [],
    fontes: Array.isArray(body.fontes) ? body.fontes : [],
    notaMinima: Number.isFinite(body.notaMinima) ? Number(body.notaMinima) : DEFAULTS.notaMinima,
    modelo: typeof body.modelo === 'string' && body.modelo ? body.modelo : undefined,
  };

  const existing = await findSettings();
  const settings = existing
    ? await storage.update<EditalSettings>('edital-settings', existing.id, patch)
    : await storage.create<EditalSettings>('edital-settings', patch);
  return NextResponse.json(settings);
}
