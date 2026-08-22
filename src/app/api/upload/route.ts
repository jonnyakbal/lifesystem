import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: jpg, png, gif, webp' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // Optimize with sharp if available and if over 2MB
    if (buffer.length > MAX_SIZE_BYTES) {
      try {
        const sharp = (await import('sharp')).default;
        
        // Determine format for output
        const isPng = file.type === 'image/png';
        const outputFormat = isPng ? 'png' : 'jpeg';
        const outputQuality = isPng ? undefined : 80;

        // Resize to max 1920px wide, maintain aspect ratio
        let pipeline = sharp(buffer)
          .resize(1920, 1080, { 
            fit: 'inside', 
            withoutEnlargement: true 
          });

        if (outputFormat === 'jpeg') {
          pipeline = pipeline.jpeg({ quality: outputQuality!, mozjpeg: true });
        } else {
          pipeline = pipeline.png({ quality: 80, compressionLevel: 9 });
        }

        buffer = await pipeline.toBuffer();
      } catch (sharpError) {
        console.warn('Sharp optimization failed, using original:', sharpError);
        // Continue with original buffer
      }
    }

    // Final size check
    if (buffer.length > MAX_SIZE_BYTES) {
      // Try more aggressive compression
      try {
        const sharp = (await import('sharp')).default;
        buffer = await sharp(buffer)
          .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 60, mozjpeg: true })
          .toBuffer();
      } catch {
        return NextResponse.json({ 
          error: 'Image too large even after optimization. Max 2MB.' 
        }, { status: 400 });
      }
    }

    if (buffer.length > MAX_SIZE_BYTES) {
      return NextResponse.json({ 
        error: 'Image too large. Max 2MB.' 
      }, { status: 400 });
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate filename
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'jpg';
    const filename = `${uuid()}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);

    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;

    return NextResponse.json({ 
      url, 
      filename,
      originalSize: file.size,
      optimizedSize: buffer.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
