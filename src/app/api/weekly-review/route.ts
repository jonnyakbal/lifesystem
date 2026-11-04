import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { latestReview, weeklyReviewInputSchema, WEEKLY_REVIEW_COLLECTION, type WeeklyReview } from '@/lib/weekly-review';

// GET devolve a revisão mais recente (ou null); POST registra uma revisão concluída.
export async function GET() {
  try {
    return NextResponse.json(latestReview(await storage.getAll<WeeklyReview>(WEEKLY_REVIEW_COLLECTION)));
  } catch { return NextResponse.json({ error: 'Não foi possível consultar a última revisão.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Envie a revisão em JSON válido.' }, { status: 400 }); }
  const parsed = weeklyReviewInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Revisão inválida.' }, { status: 400 });
  try {
    const review = await storage.create<WeeklyReview>(WEEKLY_REVIEW_COLLECTION, { ...parsed.data, completedAt: new Date().toISOString() });
    return NextResponse.json(review, { status: 201 });
  } catch { return NextResponse.json({ error: 'Não foi possível registrar a revisão.' }, { status: 500 }); }
}
