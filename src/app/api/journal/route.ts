import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { JournalEntry } from '@/types';

export async function GET() {
  const entries = await storage.getAll<JournalEntry>('journal');
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Check if entry exists for this date
  const existing = await storage.query<JournalEntry>('journal', { entryDate: body.entryDate });
  
  if (existing.length > 0) {
    const updated = await storage.update<JournalEntry>('journal', existing[0].id, {
      content: body.content,
      pillarChecks: body.pillarChecks,
      gratitude: body.gratitude,
    });
    return NextResponse.json(updated);
  }
  
  const entry = await storage.create<JournalEntry>('journal', {
    content: body.content,
    pillarChecks: body.pillarChecks || {},
    gratitude: body.gratitude,
    entryDate: body.entryDate,
  });
  return NextResponse.json(entry, { status: 201 });
}
