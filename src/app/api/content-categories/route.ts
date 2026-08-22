import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ContentCategory } from '@/types';

export async function GET() {
  const categories = await storage.getAll<ContentCategory>('content_categories');
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const category = await storage.create<ContentCategory>('content_categories', {
    name: body.name,
    icon: body.icon || '📁',
    color: body.color || 'primary',
    sortOrder: body.sortOrder || 0,
  });
  return NextResponse.json(category, { status: 201 });
}
