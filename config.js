/** Owner-controlled settings: no build system required. */
export const SITE = {
  DATA_SOURCE: 'demo', // demo, json, supabase
  DATA_FILE: './data/nests.json',
  DEMO_FILE: './data/demo-nests.json',
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: '', // browser-safe public key; NEVER a service-role key
  ORGANIZATION_NAME: 'TRACC',
  WEBSITE_URL: 'https://tracc.org/',
  // Optional artist-supplied illustration paths. Leave blank to keep original artwork/icons.
  HERO_ART_URL: '', // e.g. './assets/illustrations/community-turtle.png'
  STATUS_ICONS: { incubating: '', emergence_soon: '', awaiting_update: '', emerged: '', excavated: '' },
  INSTAGRAM_URL: 'https://www.instagram.com/traccborneo/',
};
