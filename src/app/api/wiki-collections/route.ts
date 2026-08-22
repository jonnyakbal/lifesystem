import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { WikiCollection } from '@/types';

export async function GET() {
  const collections = await storage.getAll<WikiCollection>('wiki-collections');
  return NextResponse.json(collections);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const collection = await storage.create<WikiCollection>('wiki-collections', {
    name: body.name,
    description: body.description || '',
    icon: body.icon || '📁',
    color: body.color || 'primary',
    sortOrder: body.sortOrder || 0,
  });
  return NextResponse.json(collection, { status: 201 });
}
