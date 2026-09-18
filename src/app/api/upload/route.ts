import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const UPLOAD_DIR = process.env.LIFESYSTEM_UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Upload muito grande. Máximo: 2MB.' }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo inválido. Use jpg, png, gif ou webp.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Imagem muito grande. Máximo: 2MB.' }, { status: 413 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const sharp = (await import('sharp')).default;
    const image = sharp(inputBuffer, { limitInputPixels: 25_000_000 });
    const metadata = await image.metadata();
    if (!metadata.format || !['jpeg', 'png', 'gif', 'webp'].includes(metadata.format)) {
      return NextResponse.json({ error: 'Conteúdo de imagem inválido' }, { status: 400 });
    }

    let buffer = await image
      .rotate()
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    if (buffer.length > MAX_SIZE_BYTES) {
      buffer = await sharp(buffer)
        .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer();
    }
    if (buffer.length > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Imagem muito grande após otimização' }, { status: 413 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(UPLOAD_DIR, filename), buffer);

    return NextResponse.json({
      url: `/uploads/${filename}`,
      filename,
      originalSize: file.size,
      optimizedSize: buffer.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Falha no upload' }, { status: 500 });
  }
}
