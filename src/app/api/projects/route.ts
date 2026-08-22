import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Project } from '@/types';

export async function GET() {
  const projects = await storage.getAll<Project>('projects');
  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const project = await storage.create<Project>('projects', {
    name: body.name,
    description: body.description,
    status: body.status || 'idea',
    stack: body.stack || [],
    needs: body.needs || '',
    links: body.links || [],
    tasksCount: 0,
    tasksDone: 0,
    coverUrl: body.coverUrl || '',
    coverColor: body.coverColor || '',
  });
  return NextResponse.json(project, { status: 201 });
}
