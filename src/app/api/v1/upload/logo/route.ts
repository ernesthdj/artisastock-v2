import { NextRequest, NextResponse } from 'next/server';
import { withPermission, apiError } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export const POST = withPermission('cms:write', async (
  request: NextRequest,
  ctx: { tenantId: string }
) => {
  const formData = await request.formData().catch(() => null);
  if (!formData) return apiError('INVALID_FORM', 'FormData invalide', 400);

  const file = formData.get('file') as File | null;
  if (!file) return apiError('MISSING_FILE', 'Fichier requis', 400);
  if (!ALLOWED_TYPES.includes(file.type)) {
    return apiError('INVALID_TYPE', 'Type de fichier non supporté', 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return apiError('FILE_TOO_LARGE', 'Fichier trop volumineux (max 2 MB)', 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let logoBuffer: Buffer;
  let logoUrl: string;

  if (file.type === 'image/svg+xml') {
    // SVG — pas de traitement sharp
    logoBuffer = buffer;
    logoUrl = `https://cdn.artisastock.be/${ctx.tenantId}/logo/logo.svg`;
  } else {
    logoBuffer = await sharp(buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
    logoUrl = `https://cdn.artisastock.be/${ctx.tenantId}/logo/logo.webp`;
  }

  // Mettre à jour la SiteConfig avec la nouvelle URL
  await prisma.siteConfig.update({
    where: { tenantId: ctx.tenantId },
    data: { logo: logoUrl },
  });

  return NextResponse.json(
    { success: true, data: { url: logoUrl, size: logoBuffer.byteLength } },
    { status: 201 }
  );
});
