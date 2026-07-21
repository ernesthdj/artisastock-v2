import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge ne connaît pas nos scales custom (tailwind.config.ts) — sans ça,
// `text-erp-sm` (taille) et `text-[#hex]` (couleur) sont vus comme le même groupe
// "text color" et l'un écrase l'autre silencieusement.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['erp-xs', 'erp-sm', 'erp-md', 'erp-lg', 'erp-xl', 'erp-2xl', 'erp-3xl'] }],
      rounded: [{ rounded: ['rx-sm', 'rx-md', 'rx-input', 'rx-card', 'rx-doc', 'rx-pill'] }],
      shadow: [{ shadow: ['sh-1', 'sh-2', 'sh-3', 'sh-gold', 'sh-card', 'sh-pop', 'sh-rail'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
