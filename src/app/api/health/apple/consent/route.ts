import { NextRequest, NextResponse } from 'next/server';
import { requireProfessionalOwner } from '@/lib/professional/owner-auth';
import { appleConsentStatus, createAppleToken, revokeAppleToken } from '@/lib/health/apple';

// Consentimento do Apple Saúde: ver estado, gerar (ou trocar) a chave e revogar.
// Só com sessão humana; a chave aparece uma única vez, na resposta do POST.
export async function GET() {
  try { return NextResponse.json(await appleConsentStatus()); }
  catch { return NextResponse.json({ error: 'Não foi possível consultar a integração.' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try { await requireProfessionalOwner(request); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 403 }); }
  try { return NextResponse.json({ token: await createAppleToken(), status: await appleConsentStatus() }, { status: 201 }); }
  catch { return NextResponse.json({ error: 'Não foi possível gerar a chave.' }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try { await requireProfessionalOwner(request); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 403 }); }
  try { await revokeAppleToken(); return NextResponse.json(await appleConsentStatus()); }
  catch { return NextResponse.json({ error: 'Não foi possível revogar a chave.' }, { status: 500 }); }
}
