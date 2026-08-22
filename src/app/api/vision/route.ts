import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { VisionDocument } from '@/types';

export async function GET() {
  const documents = await storage.getAll<VisionDocument>('vision');
  return NextResponse.json(documents);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Check if document exists for this section
  const existing = await storage.query<VisionDocument>('vision', { section: body.section });
  
  if (existing.length > 0) {
    const updated = await storage.update<VisionDocument>('vision', existing[0].id, {
      content: body.content,
      title: body.title,
    });
    return NextResponse.json(updated);
  }
  
  const doc = await storage.create<VisionDocument>('vision', {
    section: body.section,
    title: body.title,
    content: body.content,
    sortOrder: 0,
  });
  return NextResponse.json(doc, { status: 201 });
}
