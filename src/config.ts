export const APP_CONFIG = {
  appName: import.meta.env.VITE_APP_NAME || 'Maps',
  organizationName: import.meta.env.VITE_ORG_NAME || 'Local Institution',
  brandLogo: import.meta.env.VITE_BRAND_LOGO || `${import.meta.env.BASE_URL}icon.svg`,
  tagline: import.meta.env.VITE_APP_TAGLINE || 'Cooperatives and local production',
  territoryName: import.meta.env.VITE_TERRITORY_NAME || 'Local territory',
  territoryDescription: import.meta.env.VITE_TERRITORY_DESCRIPTION
    || 'A territorial platform to discover local supply, manage public profiles and plan community routes.',
  adminContactEmail: import.meta.env.VITE_ADMIN_CONTACT_EMAIL || 'admin@example.com',
  poweredByLabel: import.meta.env.VITE_POWERED_BY_LABEL || 'Powered by Kaizen',
  poweredByUrl: import.meta.env.VITE_POWERED_BY_URL || 'https://www.get-kaizen.click',
  aiProviderLabel: import.meta.env.VITE_AI_PROVIDER_LABEL || 'Gemini',
  featuredCoopKeyword: import.meta.env.VITE_FEATURED_COOP_KEYWORD || 'semilla',
  featuredCoopLabel: import.meta.env.VITE_FEATURED_COOP_LABEL || 'Cooperativa Semilla',
};
