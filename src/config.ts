export const APP_CONFIG = {
  appName: import.meta.env.VITE_APP_NAME || 'Maps',
  organizationName: import.meta.env.VITE_ORG_NAME || 'Institucion local',
  brandLogo: import.meta.env.VITE_BRAND_LOGO || `${import.meta.env.BASE_URL}icon.svg`,
  tagline: import.meta.env.VITE_APP_TAGLINE || 'Cooperativas y produccion local',
  territoryName: import.meta.env.VITE_TERRITORY_NAME || 'territorio local',
  panelTitle: import.meta.env.VITE_PANEL_TITLE || 'Cooperativas del territorio',
  territoryDescription: import.meta.env.VITE_TERRITORY_DESCRIPTION
    || 'Una plataforma territorial para visibilizar oferta local, gestionar perfiles publicos y planificar recorridos comunitarios.',
  adminContactEmail: import.meta.env.VITE_ADMIN_CONTACT_EMAIL || 'admin@example.com',
  poweredByLabel: import.meta.env.VITE_POWERED_BY_LABEL || 'Powered by Kaizen',
  poweredByUrl: import.meta.env.VITE_POWERED_BY_URL || 'https://www.get-kaizen.click',
  aiProviderLabel: import.meta.env.VITE_AI_PROVIDER_LABEL || 'Gemini',
  featuredCoopKeyword: import.meta.env.VITE_FEATURED_COOP_KEYWORD || 'semilla',
  featuredCoopLabel: import.meta.env.VITE_FEATURED_COOP_LABEL || 'Cooperativa Semilla',
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  },
  roleEmails: {
    admin: String(import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((email: string) => email.trim().toLowerCase()).filter(Boolean),
    maintainer: String(import.meta.env.VITE_MAINTAINER_EMAILS || '').split(',').map((email: string) => email.trim().toLowerCase()).filter(Boolean),
  },
};
