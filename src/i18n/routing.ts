import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'nl'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
});
