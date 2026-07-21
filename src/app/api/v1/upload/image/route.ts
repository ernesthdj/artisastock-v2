import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError } from '@/lib/permissions';
import sharp from 'sharp';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  return withAuth(request, async (ctx) => {
  const formData = await request.formData().catch(() => null);
  if (!formData) return apiError('INVALID_FORM', 'FormData invalide', 400);

  const file = formData.get('file') as File | null;
  if (!file) return apiError('MISSING_FILE', 'Fichier requis', 400);
  if (!ALLOWED_TYPES.includes(file.type)) {
    return apiError('INVALID_TYPE', 'Type de fichier non supporté (JPEG, PNG, WebP uniquement)', 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return apiError('FILE_TOO_LARGE', 'Fichier trop volumineux (max 5 MB)', 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Redimensionner et convertir en WebP
  const optimized = await sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  // En production, uploader vers un service de stockage (ex: S3, Cloudflare R2)
  // Ici, on simule un URL de retour
  // TODO: Remplacer par upload vers bucket configuré
  const mockUrl = `https://cdn.artisastock.be/${ctx.tenantId}/images/${Date.now()}.webp`;

    return NextResponse.json(
      { success: true, data: { url: mockUrl, size: optimized.byteLength } },
      { status: 201 }
    );
  });
}
