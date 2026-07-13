// Types pour le CMS bloc-based

export interface BlockBase {
  id: string;
  type: string;
  order: number;
  visible: boolean;
}

export interface HeroBlock extends BlockBase {
  type: 'HERO';
  config: {
    title: string;
    subtitle?: string;
    backgroundImage?: string;
    ctaText?: string;
    ctaLink?: string;
    overlay?: boolean;
    overlayOpacity?: number;
  };
}

export interface TextBlock extends BlockBase {
  type: 'TEXT';
  config: {
    content: string;
    alignment?: 'left' | 'center' | 'right';
  };
}

export interface ImageBlock extends BlockBase {
  type: 'IMAGE';
  config: {
    url: string;
    alt: string;
    caption?: string;
    width?: 'full' | 'contained';
  };
}

export interface GalleryBlock extends BlockBase {
  type: 'GALLERY';
  config: {
    images: Array<{ url: string; alt: string; caption?: string }>;
    layout: 'grid' | 'masonry' | 'carousel';
    columns?: 2 | 3 | 4;
  };
}

export interface ProductsBlock extends BlockBase {
  type: 'PRODUCTS';
  config: {
    title?: string;
    category?: string;
    limit?: number;
    layout: 'grid' | 'carousel';
    columns?: 2 | 3 | 4;
  };
}

export interface ContactBlock extends BlockBase {
  type: 'CONTACT';
  config: {
    showMap: boolean;
    showForm: boolean;
    showHours: boolean;
    showPhone: boolean;
    showEmail: boolean;
    mapCoordinates?: { lat: number; lng: number };
  };
}

export interface TestimonialsBlock extends BlockBase {
  type: 'TESTIMONIALS';
  config: {
    title?: string;
    testimonials: Array<{
      author: string;
      text: string;
      rating?: number;
      avatarUrl?: string;
    }>;
  };
}

export interface MapBlock extends BlockBase {
  type: 'MAP';
  config: {
    lat: number;
    lng: number;
    zoom?: number;
    address?: string;
  };
}

export interface CustomHtmlBlock extends BlockBase {
  type: 'CUSTOM_HTML';
  config: {
    html: string;
  };
}

export type Block =
  | HeroBlock
  | TextBlock
  | ImageBlock
  | GalleryBlock
  | ProductsBlock
  | ContactBlock
  | TestimonialsBlock
  | MapBlock
  | CustomHtmlBlock;

export interface SiteColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface SiteFonts {
  heading: string;
  body: string;
}
