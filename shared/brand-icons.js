/**
 * Local brand marks (simplified SVG) for popup rows — no network.
 * Keys match signature ids.
 */

/** @type {Record<string, { bg: string, svg: string }>} */
export const BRAND_ICONS = {
  nextjs: {
    bg: '#000000',
    svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#000"/><path d="M8 7.5h2.2l5.3 9H13.3L8 7.5z" fill="#fff"/><path d="M15.2 7.5H17v9h-1.8V7.5z" fill="#fff"/><path d="M9.5 16.5 17 8" stroke="#fff" stroke-width="1.6"/></svg>',
  },
  react: {
    bg: '#0a0a0a',
    svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="2.2" fill="#61DAFB"/><ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="#61DAFB" stroke-width="1.3" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="#61DAFB" stroke-width="1.3" transform="rotate(-60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="#61DAFB" stroke-width="1.3"/></svg>',
  },
  vue: {
    bg: '#1a1a1a',
    svg: '<svg viewBox="0 0 24 24"><path d="M2 4h4.5L12 14.5 17.5 4H22L12 22 2 4z" fill="#41B883"/><path d="M6.5 4H12l-2.5 4.5L12 13 6.5 4z" fill="#35495E"/><path d="M17.5 4H12l2.5 4.5L12 13l5.5-9z" fill="#35495E"/></svg>',
  },
  nuxt: {
    bg: '#020420',
    svg: '<svg viewBox="0 0 24 24"><path d="M9.5 18.5 3 7.5h5.2l3.3 5.7 3.2-5.7H20L13.5 18.5H9.5z" fill="#00DC82"/></svg>',
  },
  angular: {
    bg: '#1a1a1a',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 2 2.5 5.5l1.5 13L12 22l8-3.5 1.5-13L12 2z" fill="#DD0031"/><path d="M12 4.2 19.2 7l-1.2 10.2L12 19.8l-6-2.6L4.8 7 12 4.2z" fill="#C3002F"/><path d="m12 6.5 3.8 9h-2.1l-.7-1.8H9l-.7 1.8H6.2L12 6.5zm0 3.2-1.2 3h2.4L12 9.7z" fill="#fff"/></svg>',
  },
  svelte: {
    bg: '#1a1a1a',
    svg: '<svg viewBox="0 0 24 24"><path d="M18.5 4.8c-1.7-2.4-5-3-7.4-1.4L7.5 5.8a4.5 4.5 0 0 0-1.8 6.1 4.7 4.7 0 0 0 .7.9l.2.1a5.6 5.6 0 0 0-.7-1 3.2 3.2 0 0 1 1.3-4.4l3.6-2.4c1.7-1.1 4-.6 5.1 1.1a3.2 3.2 0 0 1-.4 4l-1.4 1a2 2 0 0 1-1.1.3h-.2a1.8 1.8 0 0 1-1.7-1.4 1 1 0 0 0-1-.8 1 1 0 0 0-1 1 3.7 3.7 0 0 0 3.6 3.1 3.6 3.6 0 0 0 2-.6l3.6-2.4c2.4-1.6 3-5 1.4-7.4z" fill="#FF3E00"/><path d="M19.3 11.2a4.5 4.5 0 0 0-.7-.9l-.2-.1c.3.5.5 1 .7 1.5a3.2 3.2 0 0 1-1.3 4.4l-3.6 2.4c-1.7 1.1-4 .6-5.1-1.1a3.2 3.2 0 0 1 .4-4l1.4-1a2 2 0 0 1 1.1-.3h.2a1.8 1.8 0 0 1 1.7 1.4 1 1 0 0 0 1 .8 1 1 0 0 0 1-1 3.7 3.7 0 0 0-3.6-3.1 3.6 3.6 0 0 0-2 .6l-3.6 2.4c-2.4 1.6-3 5-1.4 7.4 1.7 2.4 5 3 7.4 1.4l3.6-2.4a4.5 4.5 0 0 0 1.8-6.1z" fill="#FF3E00"/></svg>',
  },
  sveltekit: {
    bg: '#1a1a1a',
    svg: '<svg viewBox="0 0 24 24"><path d="M18.5 4.8c-1.7-2.4-5-3-7.4-1.4L7.5 5.8a4.5 4.5 0 0 0-1.8 6.1 4.7 4.7 0 0 0 .7.9l.2.1a5.6 5.6 0 0 0-.7-1 3.2 3.2 0 0 1 1.3-4.4l3.6-2.4c1.7-1.1 4-.6 5.1 1.1a3.2 3.2 0 0 1-.4 4l-1.4 1a2 2 0 0 1-1.1.3h-.2a1.8 1.8 0 0 1-1.7-1.4 1 1 0 0 0-1-.8 1 1 0 0 0-1 1 3.7 3.7 0 0 0 3.6 3.1 3.6 3.6 0 0 0 2-.6l3.6-2.4c2.4-1.6 3-5 1.4-7.4z" fill="#FF3E00"/><circle cx="18" cy="17" r="3.2" fill="#FF3E00"/><path d="M16.8 17h2.4M18 15.8v2.4" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg>',
  },
  solid: {
    bg: '#0e0e14',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 3c4 0 7 2.5 7 5.5S16 14 12 14 5 11.5 5 8.5 8 3 12 3z" fill="#76B3E1"/><path d="M5 14.5c0 3 3.1 5.5 7 5.5s7-2.5 7-5.5c0-1.2-.5-2.3-1.4-3.2C16.2 13.5 14.2 15 12 15s-4.2-1.5-5.6-3.7c-.9.9-1.4 2-1.4 3.2z" fill="#5183B0"/></svg>',
  },
  jquery: {
    bg: '#0769AD',
    svg: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5c3.5 3.8 8.2 4.6 12.2 2.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M5.5 13c3.8 4 8.8 4.8 12.8 2.6" stroke="#7acef4" stroke-width="1.6" stroke-linecap="round"/><path d="M7 9.5c3.5 3.8 8 4.6 11.5 2.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/></svg>',
  },
  redux: {
    bg: '#1a1a2e',
    svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="6.5" r="2.2" stroke="#764ABC" stroke-width="1.5"/><circle cx="6.5" cy="16" r="2.2" stroke="#764ABC" stroke-width="1.5"/><circle cx="17.5" cy="16" r="2.2" stroke="#764ABC" stroke-width="1.5"/><path d="M10.2 7.8 7.8 14.2M13.8 7.8l2.4 6.4M8.7 16h6.6" stroke="#764ABC" stroke-width="1.4"/></svg>',
  },
  zustand: {
    bg: '#2d2a26',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#F59E0B" font-family="system-ui">Z</text></svg>',
  },
  pinia: {
    bg: '#1a1a1a',
    svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#FFD859"/><circle cx="9" cy="11" r="1.2" fill="#333"/><circle cx="15" cy="11" r="1.2" fill="#333"/><path d="M9 15c1.2 1.2 4.8 1.2 6 0" stroke="#333" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>',
  },
  mobx: {
    bg: '#111',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="#FF9955" font-family="system-ui">MobX</text></svg>',
  },
  vuex: {
    bg: '#1a1a1a',
    svg: '<svg viewBox="0 0 24 24"><path d="M4 6h4l4 7 4-7h4L12 20 4 6z" fill="#41B883"/></svg>',
  },
  'react-query': {
    bg: '#18222e',
    svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="#FF4154"/><ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#FF4154" stroke-width="1.3"/><ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#FF4154" stroke-width="1.3" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#FF4154" stroke-width="1.3" transform="rotate(-60 12 12)"/></svg>',
  },
  'tanstack-query': {
    bg: '#18222e',
    svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="#FF4154"/><ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#FF4154" stroke-width="1.3"/><ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#FF4154" stroke-width="1.3" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#FF4154" stroke-width="1.3" transform="rotate(-60 12 12)"/></svg>',
  },
  'tanstack-router': {
    bg: '#0f172a',
    svg: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  'tanstack-table': {
    bg: '#0f172a',
    svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="1.5" stroke="#A78BFA" stroke-width="1.5"/><path d="M4 10h16M10 5v14" stroke="#A78BFA" stroke-width="1.5"/></svg>',
  },
  'tanstack-form': {
    bg: '#0f172a',
    svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="16" rx="2" stroke="#34D399" stroke-width="1.5"/><path d="M8 9h8M8 13h8M8 17h5" stroke="#34D399" stroke-width="1.5" stroke-linecap="round"/></svg>',
  },
  'tanstack-virtual': {
    bg: '#0f172a',
    svg: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6h12M6 12h12M6 18h8" stroke="#F472B6" stroke-width="1.8" stroke-linecap="round"/><path d="M18 15v6M15 18h6" stroke="#F472B6" stroke-width="1.5" stroke-linecap="round"/></svg>',
  },
  'tanstack-start': {
    bg: '#000',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="#FF4154" font-family="system-ui">Start</text></svg>',
  },
  tanstack: {
    bg: '#111827',
    svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#FF4154" stroke-width="1.5"/><path d="M8 14c1.5 2 6.5 2 8 0M9 10h.01M15 10h.01" stroke="#FF4154" stroke-width="1.5" stroke-linecap="round"/></svg>',
  },
  remix: {
    bg: '#121212',
    svg: '<svg viewBox="0 0 24 24"><path d="M5 6h9a4 4 0 0 1 0 8H9v4H5V6zm4 5h4a1.5 1.5 0 0 0 0-3H9v3z" fill="#E8F2FF"/><path d="M14 17c1.2 1.5 2.8 2.5 5 2.5v-2.2c-1.3 0-2.3-.5-3.1-1.4L14 17z" fill="#3992FF"/></svg>',
  },
  'react-router': {
    bg: '#CA4245',
    svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="7" cy="7" r="2.5" fill="#fff"/><circle cx="17" cy="12" r="2.5" fill="#fff"/><circle cx="7" cy="17" r="2.5" fill="#fff"/><path d="M9 8.2 14.5 11M9 15.8 14.5 13" stroke="#fff" stroke-width="1.5"/></svg>',
  },
  swr: {
    bg: '#000',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui">SWR</text></svg>',
  },
  apollo: {
    bg: '#1B2240',
    svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#311C87"/><path d="M8 15.5 12 7l4 8.5h-2.2l-.6-1.3h-2.4l-.6 1.3H8zm3.1-3.2h1.8L12 9.8l-.9 2.5z" fill="#fff"/></svg>',
  },
  urql: {
    bg: '#1a1030',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="700" fill="#B49CFF" font-family="system-ui">urql</text></svg>',
  },
  graphql: {
    bg: '#1a1020',
    svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5.5" r="1.6" fill="#E535AB"/><circle cx="5.5" cy="16.5" r="1.6" fill="#E535AB"/><circle cx="18.5" cy="16.5" r="1.6" fill="#E535AB"/><path d="M12 7.2v8.5M7 15.2l10-5.5M17 15.2 7 9.7" stroke="#E535AB" stroke-width="1.3"/></svg>',
  },
  axios: {
    bg: '#5A29E4',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui">axios</text></svg>',
  },
  tailwind: {
    bg: '#0B1120',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 6.5c-2.5 0-4.1 1.2-4.8 3.7 1-1.2 2.1-1.7 3.4-1.4.8.2 1.3.7 1.9 1.3.9 1 2 1.7 3.5 1.7 2.5 0 4.1-1.2 4.8-3.7-1 1.2-2.1 1.7-3.4 1.4-.8-.2-1.3-.7-1.9-1.3-.9-1-2-1.7-3.5-1.7zm-4.8 7.2c-2.5 0-4.1 1.2-4.8 3.7 1-1.2 2.1-1.7 3.4-1.4.8.2 1.3.7 1.9 1.3.9 1 2 1.7 3.5 1.7 2.5 0 4.1-1.2 4.8-3.7-1 1.2-2.1 1.7-3.4 1.4-.8-.2-1.3-.7-1.9-1.3-.9-1-2-1.7-3.5-1.7z" fill="#38BDF8"/></svg>',
  },
  bootstrap: {
    bg: '#712CF9',
    svg: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="#712CF9"/><path d="M9 8h4.2c1.8 0 3 .9 3 2.3 0 1-.5 1.7-1.4 2.1 1.2.4 1.9 1.3 1.9 2.5 0 1.7-1.4 2.7-3.5 2.7H9V8zm2.1 3.6h1.8c.8 0 1.3-.4 1.3-1s-.5-1-1.3-1h-1.8v2zm0 4.5h2c.9 0 1.5-.4 1.5-1.1s-.6-1.1-1.5-1.1h-2v2.2z" fill="#fff"/></svg>',
  },
  mui: {
    bg: '#001E3C',
    svg: '<svg viewBox="0 0 24 24"><path d="M4 6.5 12 2l8 4.5v4.2L12 15.2 4 10.7V6.5z" fill="#007FFF"/><path d="M4 13.2 12 17.7l8-4.5V18L12 22.5 4 18v-4.8z" fill="#007FFF" opacity=".7"/></svg>',
  },
  chakra: {
    bg: '#1A202C',
    svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#319795"/><path d="M13.5 6.5 9 12h3l-1.5 5.5L16 11h-3l.5-4.5z" fill="#fff"/></svg>',
  },
  'google-analytics': {
    bg: '#F9AB00',
    svg: '<svg viewBox="0 0 24 24"><rect x="4" y="13" width="4" height="7" rx="1" fill="#fff"/><rect x="10" y="9" width="4" height="11" rx="1" fill="#fff"/><rect x="16" y="5" width="4" height="15" rx="1" fill="#fff"/></svg>',
  },
  segment: {
    bg: '#52BD95',
    svg: '<svg viewBox="0 0 24 24"><circle cx="7" cy="12" r="3" fill="#fff"/><circle cx="17" cy="7" r="2.5" fill="#fff"/><circle cx="17" cy="17" r="2.5" fill="#fff"/><path d="M9.5 11.2 14.5 8M9.5 12.8l5 3.2" stroke="#fff" stroke-width="1.3"/></svg>',
  },
  mixpanel: {
    bg: '#7856FF',
    svg: '<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="3" fill="#fff"/><circle cx="16" cy="8" r="2.5" fill="#fff"/><circle cx="16" cy="16" r="2.5" fill="#fff"/></svg>',
  },
  hotjar: {
    bg: '#FF3C00',
    svg: '<svg viewBox="0 0 24 24"><path d="M6 17V8.5a2.5 2.5 0 0 1 5 0V15a1.5 1.5 0 0 0 3 0V8.5a2.5 2.5 0 0 1 5 0V17" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  },
  vercel: {
    bg: '#000',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 5 21 19H3L12 5z" fill="#fff"/></svg>',
  },
  netlify: {
    bg: '#05BDBA',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3zm0 2.3 5.8 3.3v6.8L12 18.7l-5.8-3.3V8.6L12 5.3z" fill="#fff"/></svg>',
  },
  cloudflare: {
    bg: '#F6821F',
    svg: '<svg viewBox="0 0 24 24"><path d="M8 15.5h11.5c1.2 0 2.2-1 2.2-2.2 0-1.1-.8-2-1.9-2.2.1-.3.2-.7.2-1 0-2.2-1.8-4-4-4-1.7 0-3.2 1.1-3.7 2.6-.5-.3-1.1-.5-1.8-.5-1.8 0-3.2 1.4-3.3 3.1H8c-1.7 0-3 1.3-3 3s1.3 3.2 3 3.2z" fill="#fff"/></svg>',
  },
  microfrontend: {
    bg: '#0f172a',
    svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="7" height="7" rx="1.5" fill="#38BDF8"/><rect x="14" y="4" width="7" height="7" rx="1.5" fill="#A78BFA"/><rect x="3" y="13" width="7" height="7" rx="1.5" fill="#34D399"/><rect x="14" y="13" width="7" height="7" rx="1.5" fill="#F472B6"/><path d="M10 7.5h4M10 16.5h4M7.5 11v2M16.5 11v2" stroke="#e2e8f0" stroke-width="1.2"/></svg>',
  },
  'module-federation': {
    bg: '#1e293b',
    svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="#60A5FA"/><circle cx="5" cy="7" r="2.2" fill="#93C5FD"/><circle cx="19" cy="7" r="2.2" fill="#93C5FD"/><circle cx="5" cy="17" r="2.2" fill="#93C5FD"/><circle cx="19" cy="17" r="2.2" fill="#93C5FD"/><path d="M7 8.2 10 10.5M17 8.2 14 10.5M7 15.8 10 13.5M17 15.8 14 13.5" stroke="#94A3B8" stroke-width="1.2"/></svg>',
  },
  'single-spa': {
    bg: '#eeebfe',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" font-size="8" font-weight="700" fill="#5B67F1" font-family="system-ui">s-spa</text></svg>',
  },
  qiankun: {
    bg: '#002b55',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="#fff" font-family="system-ui">乾坤</text></svg>',
  },
  systemjs: {
    bg: '#111',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#FECD56" font-family="system-ui">Sys</text></svg>',
  },
  'import-map': {
    bg: '#1e293b',
    svg: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M5 12h10M5 17h12" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round"/><circle cx="18" cy="12" r="2" fill="#38BDF8"/></svg>',
  },
  webpack: {
    bg: '#2B3A42',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3zm0 2.2 5.5 3.1v6.4L12 17.8l-5.5-3.1V8.3L12 5.2z" fill="#8DD6F9"/></svg>',
  },
  vite: {
    bg: '#1B1B1F',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 3 2 19h6l4-8 4 8h6L12 3z" fill="#A855F7"/><path d="M12 8.5 8.5 19h7L12 8.5z" fill="#F59E0B"/></svg>',
  },
  parcel: {
    bg: '#113C4A',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#E7DACB" font-family="system-ui">Prcl</text></svg>',
  },
  turbopack: {
    bg: '#000',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="#fff" font-family="system-ui">Turbo</text></svg>',
  },
  sentry: {
    bg: '#362D59',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 4 4 20h4.5L12 12l3.5 8H20L12 4z" fill="#362D59" stroke="#fff" stroke-width="1"/></svg>',
  },
  datadog: {
    bg: '#632CA6',
    svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#632CA6"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>',
  },
  newrelic: {
    bg: '#1CE783',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#000" font-family="system-ui">NR</text></svg>',
  },
  logrocket: {
    bg: '#764ABC',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui">LR</text></svg>',
  },
  stripe: {
    bg: '#635BFF',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui">S</text></svg>',
  },
  razorpay: {
    bg: '#0C2451',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#3395FF" font-family="system-ui">Rz</text></svg>',
  },
  auth0: {
    bg: '#EB5424',
    svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#EB5424"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>',
  },
  clerk: {
    bg: '#6C47FF',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui">Cl</text></svg>',
  },
  firebase: {
    bg: '#1A1A1A',
    svg: '<svg viewBox="0 0 24 24"><path d="M6 18 10 4l3 6 2-3 3 11H6z" fill="#FFCA28"/></svg>',
  },
  nextauth: {
    bg: '#000',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="#fff" font-family="system-ui">Auth</text></svg>',
  },
  emotion: {
    bg: '#C065DB',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui">💅</text></svg>',
  },
  'styled-components': {
    bg: '#DB7093',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui">sc</text></svg>',
  },
  launchdarkly: {
    bg: '#405BFF',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui">LD</text></svg>',
  },
  intercom: {
    bg: '#1F8DED',
    svg: '<svg viewBox="0 0 24 24"><rect x="5" y="6" width="14" height="12" rx="3" fill="#fff"/><path d="M8 11h8M8 14h5" stroke="#1F8DED" stroke-width="1.5"/></svg>',
  },
  zendesk: {
    bg: '#03363D',
    svg: '<svg viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui">Zd</text></svg>',
  },
};

const FALLBACK = {
  bg: '#1e293b',
  svg: '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3" fill="#64748b"/><path d="M8 12h8M12 8v8" stroke="#e2e8f0" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

/**
 * @param {string} id
 * @returns {{ bg: string, svg: string }}
 */
export function getBrandIcon(id) {
  return BRAND_ICONS[id] || FALLBACK;
}
