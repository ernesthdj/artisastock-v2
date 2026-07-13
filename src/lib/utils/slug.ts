import slugify from 'slugify';

export function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: 'fr',
    trim: true,
  });
}

export function generateTenantSlug(businessName: string): string {
  return generateSlug(businessName).slice(0, 50);
}
