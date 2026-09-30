import { NextRequest, NextResponse } from 'next/server';
import { getFinancialCategories, saveFinancialCategory } from '@/lib/financial-categories';
export async function GET() { return NextResponse.json(await getFinancialCategories()); }
export async function POST(request: NextRequest) {
  try { return NextResponse.json(await saveFinancialCategory(await request.json())); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Categoria inválida.' }, { status: 409 }); }
}
