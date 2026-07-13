export const BLOCK_TYPES = [
  'HERO',
  'TEXT',
  'IMAGE',
  'GALLERY',
  'PRODUCTS',
  'CONTACT',
  'TESTIMONIALS',
  'MAP',
  'CUSTOM_HTML',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  HERO: 'Bannière principale',
  TEXT: 'Texte libre',
  IMAGE: 'Image',
  GALLERY: 'Galerie photos',
  PRODUCTS: 'Catalogue produits',
  CONTACT: 'Contact & Horaires',
  TESTIMONIALS: 'Avis clients',
  MAP: 'Carte interactive',
  CUSTOM_HTML: 'HTML personnalisé',
};
