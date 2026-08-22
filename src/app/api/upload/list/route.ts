import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { stat, readdir, unlink } from 'fs/promises';

export async function GET(request: NextRequest) {
  try {
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    
    let files: string[];
    try {
      files = await readdir(uploadDir);
    } catch {
      return NextResponse.json({ files: [] });
    }

    const fileInfos = await Promise.all(
      files
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        .map(async (f) => {
          const stats = await stat(join(uploadDir, f));
          return {
            name: f,
            url: `/uploads/${f}`,
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        })
    );

    return NextResponse.json({ files: fileInfos });
  } catch (error) {
    return NextResponse.json({ files: [] });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    
    if (!filename) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    // Sanitize filename to prevent path traversal
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filepath = join(process.cwd(), 'public', 'uploads', safeName);
    
    try {
      await stat(filepath);
      await unlink(filepath);
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
