/**
 * Local signature pack — patterns match ASSETS / RUNTIME only.
 * Page copy ("Vue.js jobs") must never be enough to fire a framework hit.
 */

/** @typedef {'framework'|'platform'|'architecture'|'build'|'state'|'data'|'ui'|'auth'|'payments'|'observability'|'analytics'|'hosting'} Category */
/** @typedef {'global'|'dom'|'script'|'cookie'|'css'|'meta'|'inline'} EvidenceType */

/**
 * @typedef {object} SignatureCheck
 * @property {EvidenceType} type
 * @property {string|RegExp} pattern
 * @property {number} weight
 * @property {boolean} [strong]
 * @property {boolean} [runtime] marks true runtime proof (global / structural)
 * @property {boolean} [matchQuery] script/css only: match the full URL including ?query.
 *   By default the query string and fragment are stripped before matching, so a
 *   search URL (?q=logrocket) or a cache-buster can never fire a rule.
 */

/**
 * @typedef {object} SignatureRule
 * @property {string} id
 * @property {string} name
 * @property {Category} category
 * @property {SignatureCheck[]} checks
 * @property {string[]} [related]
 * @property {boolean} [requiresRuntime] framework needs runtime/asset proof (not weak DOM alone)
 */

/** @type {SignatureRule[]} */
export const SIGNATURES = [
  // ── Frameworks ──────────────────────────────────────────────
  {
    id: 'nextjs',
    name: 'Next.js',
    category: 'framework',
    related: ['react'],
    requiresRuntime: true,
    checks: [
      { type: 'script', pattern: /\/_next\/static\//i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /\/_next\/image(?:\?|$)/i, weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /\/_next\//i, weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: 'script#__NEXT_DATA__', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__NEXT_DATA__', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__next_f', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'webpackChunk_N_E', weight: 4, strong: true, runtime: true },
      // window.next is set by the App Router, but also by other Next-compatible
      // runtimes and by DOM clobbering (<a id="next">). Corroboration only.
      { type: 'global', pattern: 'next', weight: 1 },
      { type: 'dom', pattern: 'next-route-announcer', weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '[data-nextjs-scroll-focus-boundary]', weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '#__next', weight: 2 },
      { type: 'inline', pattern: /\bself\.__next_f\b|\b__NEXT_DATA__\b|\bwebpackChunk_N_E\b/, weight: 5, strong: true, runtime: true },
      { type: 'meta', pattern: /^generator=.*\bnext\.?js\b/i, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'react',
    name: 'React',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      // Same criterion as React DevTools: a renderer registered on the hook
      // (the hook object alone is injected on EVERY page by the RDT extension)
      { type: 'global', pattern: '__reactRenderer', weight: 5, strong: true, runtime: true },
      // Fiber/container keys on a host node (React 16+)
      { type: 'global', pattern: '__reactFiber', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__reactContainer', weight: 5, strong: true, runtime: true },
      // react-dom stamps _reactListening<random> on the root container and document
      { type: 'global', pattern: '__reactListening', weight: 5, strong: true, runtime: true },
      // UMD globals only if they look like the real library (probe enforces)
      { type: 'global', pattern: 'React', weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'ReactDOM', weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '[data-reactroot]', weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '[data-reactid]', weight: 3, strong: true, runtime: true },
      // CDN / path assets only (detect.js never matches prose)
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|cdnjs|esm\.sh)\/.*(?<![\w@.-])(?<!@[\w.-]+\/)react(?:-dom)?(?:@|\/)/i, weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)react(?:-dom)?@\d+\.\d+/i, weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w.-])react(?:-dom)?\.(?:production|development)(?:\.min)?\.js/i, weight: 4, strong: true, runtime: true },
      // Never match bare __REACT_DEVTOOLS_GLOBAL_HOOK__ in page scripts (extension injects it)
      { type: 'inline', pattern: /react(?:-dom)?\.(?:production|development)(?:\.min)?\.js/i, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'vue',
    name: 'Vue',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      // Mounted Vue 3 app on its container — the only reliable prod fingerprint
      { type: 'global', pattern: '__vue_app__', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__vue2__', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__VUE__', weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'Vue', weight: 3, strong: true, runtime: true },
      // Vue 3 stamps this on the mount container at hydration/mount
      { type: 'dom', pattern: '[data-v-app]', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|cdnjs|esm\.sh)\/.*\bvue(?:@|\/)/i, weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /\/vue@[\d.]+/i, weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /vue\.(?:global|runtime|esm-browser|esm-bundler)(?:\.prod)?(?:\.min)?\.js/i, weight: 4, strong: true, runtime: true },
      // data-v-* alone is NEVER enough (see resolve) — weight 1, not strong
      { type: 'dom', pattern: '[data-v-]', weight: 1 },
    ],
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    category: 'framework',
    related: ['vue'],
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: '__NUXT__', weight: 5, strong: true, runtime: true },
      { type: 'dom', pattern: '#__nuxt', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /\/_nuxt\//i, weight: 4, strong: true, runtime: true },
      { type: 'meta', pattern: /^generator=.*\bnuxt\b/i, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'angular',
    name: 'Angular',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'dom', pattern: '[ng-version]', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'getAllAngularRootElements', weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'ng', weight: 2, runtime: true },
      // Flag token emitted by the content-script probe (which ORs _ngcontent/_nghost)
      { type: 'dom', pattern: '[_ngcontent-]', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /(?:^|[\/@])@angular\//i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'svelte',
    name: 'Svelte',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: '__svelte', weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '.svelte-', weight: 2 },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*\bsvelte(?:@|\/)/i, weight: 3, strong: true, runtime: true },
      { type: 'script', pattern: /\/svelte@[\d.]+/i, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'sveltekit',
    name: 'SvelteKit',
    category: 'framework',
    related: ['svelte'],
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: '__sveltekit', weight: 5, strong: true, runtime: true },
      { type: 'dom', pattern: '[data-sveltekit-hydrate]', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /\/_app\/immutable\//i, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'solid',
    name: 'Solid',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*\bsolid-js(?:@|\/)/i, weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /\/solid-js@/i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'jquery',
    name: 'jQuery',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: 'jQuery', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /jquery(?:[-.][\d.]+)?(?:\.min)?\.js(?:[?#]|$)/i, weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /code\.jquery\.com\/jquery/i, weight: 4, strong: true, runtime: true },
    ],
  },
  /**
   * Remix (Remix Run) — full-stack React framework.
   * ChatGPT web (chatgpt.com) moved Next.js → Remix (widely reported Sep 2024;
   * confirmed via client fingerprints / community reverse-engineering, e.g.
   * Ryan Florence "New Remix app just dropped: chatgpt.com"). Not TanStack Start.
   */
  {
    id: 'remix',
    name: 'Remix',
    category: 'framework',
    related: ['react', 'react-router'],
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: '__remixContext', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__remixManifest', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__remixRouter', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__remixRouteModules', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /@remix-run\/(?:react|node|cloudflare|deno|serve)(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*@remix-run\//i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /\/build\/(?:entry\.client|root|routes)/i, weight: 2 },
      { type: 'inline', pattern: /\b__remixContext\b|\b__remixManifest\b|@remix-run\//, weight: 5, strong: true, runtime: true },
      { type: 'meta', pattern: /^generator=.*\bremix\b/i, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'react-router',
    name: 'React Router',
    category: 'data',
    related: ['react'],
    checks: [
      // React Router v6.4+ data APIs / Remix-adjacent; v7 merges with Remix lineage
      { type: 'global', pattern: '__reactRouterDataRouter', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__staticRouterHydrationData', weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: '__reactRouterVersion', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /@react-router\/(?:dom|dev|node|cloudflare)(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)react-router(?:-dom)?(?:@|\/)\d+\.\d+/i, weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*(?<![\w@.-])(?<!@[\w.-]+\/)react-router(?:-dom)?(?:@|\/)/i, weight: 4, strong: true, runtime: true },
      { type: 'inline', pattern: /@react-router\/(?:dom|dev|node)/i, weight: 3, strong: true, runtime: true },
    ],
  },

  // ── State (path-scoped assets) ──────────────────────────────
  {
    id: 'redux',
    name: 'Redux',
    category: 'state',
    checks: [
      // Do NOT use bare __REDUX_DEVTOOLS_EXTENSION__ — the RDT-style extension
      // injects that hook on every page. Probe sets __reduxStore only when a store exists.
      { type: 'global', pattern: '__reduxStore', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:\/|@)redux(?:@|\/|\.min\.js|\.js)/i, weight: 3, strong: true },
      { type: 'script', pattern: /(?:unpkg|jsdelivr|esm\.sh).*\/redux(?:@|\/)/i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'zustand',
    name: 'Zustand',
    category: 'state',
    checks: [
      { type: 'script', pattern: /(?:\/|@)zustand(?:@|\/|\.js)/i, weight: 3, strong: true },
    ],
  },
  {
    id: 'pinia',
    name: 'Pinia',
    category: 'state',
    checks: [
      { type: 'global', pattern: '__PINIA__', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /(?:\/|@)pinia(?:@|\/|\.js)/i, weight: 3, strong: true },
    ],
  },
  {
    id: 'mobx',
    name: 'MobX',
    category: 'state',
    checks: [
      { type: 'global', pattern: '__MOBX__', weight: 3, strong: true, runtime: true },
      { type: 'script', pattern: /(?:\/|@)mobx(?:@|\/|\.min|\.js)/i, weight: 3, strong: true },
    ],
  },
  {
    id: 'vuex',
    name: 'Vuex',
    category: 'state',
    checks: [
      { type: 'script', pattern: /(?:\/|@)vuex(?:@|\/|\.js)/i, weight: 3, strong: true },
    ],
  },

  // ── Data / TanStack ─────────────────────────────────────────
  {
    id: 'tanstack-query',
    name: 'TanStack Query',
    category: 'data',
    related: ['tanstack'],
    checks: [
      // Scoped packages only — never bare "query" in prose
      { type: 'script', pattern: /@tanstack\/(?:react|vue|solid|svelte|angular)-query(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /@tanstack\/query-core(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*@tanstack\/(?:react|vue|solid)-query/i, weight: 5, strong: true, runtime: true },
      // Legacy package name (pre-TanStack rebrand)
      { type: 'script', pattern: /(?:\/|@)react-query(?:@|\/)/i, weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: '__TANSTACK_QUERY_CLIENT__', weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'ReactQuery', weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'tanstack-router',
    name: 'TanStack Router',
    category: 'data',
    related: ['tanstack'],
    checks: [
      { type: 'script', pattern: /@tanstack\/(?:react|solid|vue)-router(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /@tanstack\/router-core(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*@tanstack\/(?:react-)?router/i, weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__TANSTACK_ROUTER__', weight: 4, strong: true, runtime: true },
      { type: 'inline', pattern: /@tanstack\/(?:react-)?router/i, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'tanstack-table',
    name: 'TanStack Table',
    category: 'data',
    related: ['tanstack'],
    checks: [
      { type: 'script', pattern: /@tanstack\/(?:react|vue|solid|svelte|angular|lit)-table(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /@tanstack\/table-core(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*@tanstack\/(?:react-)?table/i, weight: 5, strong: true, runtime: true },
      // Very old name
      { type: 'script', pattern: /(?:\/|@)react-table(?:@|\/)/i, weight: 3, strong: true },
    ],
  },
  {
    id: 'tanstack-form',
    name: 'TanStack Form',
    category: 'data',
    related: ['tanstack'],
    checks: [
      { type: 'script', pattern: /@tanstack\/(?:react|vue|solid|angular)-form(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /@tanstack\/form-core(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*@tanstack\/(?:react-)?form/i, weight: 5, strong: true, runtime: true },
    ],
  },
  {
    id: 'tanstack-virtual',
    name: 'TanStack Virtual',
    category: 'data',
    related: ['tanstack'],
    checks: [
      { type: 'script', pattern: /@tanstack\/(?:react|vue|solid|svelte|angular|lit)-virtual(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /@tanstack\/virtual-core(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*@tanstack\/(?:react-)?virtual/i, weight: 5, strong: true, runtime: true },
    ],
  },
  /**
   * TanStack Start — full-stack framework (tanstack.com/stack/framework).
   * Route model = TanStack Router; server boundary = Start (SSR, server fns).
   * Distinct from Next.js; OpenAI ChatGPT is generally Next — detect Start only
   * from real Start/Router package paths and runtime markers.
   */
  {
    id: 'tanstack-start',
    name: 'TanStack Start',
    category: 'framework',
    related: ['tanstack', 'tanstack-router', 'react'],
    requiresRuntime: true,
    checks: [
      { type: 'script', pattern: /@tanstack\/react-start(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /@tanstack\/solid-start(?:@|\/|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /@tanstack\/(?:react-)?start(?:@|\/|\/plugin|\/server)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*@tanstack\/(?:react-)?start/i, weight: 5, strong: true, runtime: true },
      // Vite plugin / build fingerprints sometimes appear in chunk URLs
      { type: 'script', pattern: /(?<![\w-])tanstack[_-]start[\w.-]*\.m?js$/i, weight: 3, strong: true },
      { type: 'inline', pattern: /@tanstack\/(?:react|solid)-start|\bcreateServerFn\s*\(|\bcreateStartHandler\s*\(/, weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__TANSTACK_START__', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__TSR_SSR__', weight: 4, strong: true, runtime: true },
      { type: 'meta', pattern: /^generator=.*tanstack\s*start/i, weight: 3, strong: true, runtime: true },
    ],
  },
  // Umbrella: any TanStack package path (for headline / “uses TanStack”)
  {
    id: 'tanstack',
    name: 'TanStack',
    category: 'data',
    checks: [
      { type: 'script', pattern: /@tanstack\//i, weight: 3, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/npm\/@tanstack\//i, weight: 3, strong: true, runtime: true },
      { type: 'global', pattern: '__TANSTACK__', weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'swr',
    name: 'SWR',
    category: 'data',
    checks: [
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh)\/.*\bswr(?:@|\/)/i, weight: 3, strong: true },
      { type: 'script', pattern: /\/swr@[\d.]+/i, weight: 3, strong: true },
    ],
  },
  {
    id: 'apollo',
    name: 'Apollo Client',
    category: 'data',
    checks: [
      { type: 'global', pattern: '__APOLLO_CLIENT__', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /@apollo\/client|(?:\/|@)apollo-client/i, weight: 4, strong: true },
    ],
  },
  {
    id: 'urql',
    name: 'urql',
    category: 'data',
    checks: [
      { type: 'script', pattern: /(?:\/|@)urql(?:@|\/)/i, weight: 3, strong: true },
    ],
  },
  {
    id: 'graphql',
    name: 'GraphQL',
    category: 'data',
    checks: [
      // Library assets only — a /graphql API endpoint is not the graphql package
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)graphql(?:-tag)?@\d|\/graphql(?:-tag)?(?:\.min)?\.js$/i, weight: 2 },
    ],
  },
  {
    id: 'axios',
    name: 'Axios',
    category: 'data',
    checks: [
      { type: 'global', pattern: 'axios', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /(?:\/|@)axios(?:@|\/|\.min\.js|\.js)/i, weight: 3, strong: true },
    ],
  },

  // ── UI ──────────────────────────────────────────────────────
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    category: 'ui',
    checks: [
      { type: 'css', pattern: /(?<![\w-])tailwind(?:css)?(?:\.min)?\.css$|(?<![\w@.-])(?<!@[\w.-]+\/)tailwindcss@\d/i, weight: 4, strong: true },
      { type: 'script', pattern: /cdn\.tailwindcss\.com|(?<![\w@.-])(?<!@[\w.-]+\/)@?tailwindcss(?:@\d|\/browser)/i, weight: 4, strong: true },
      // --tw-* custom properties computed on the page: Tailwind's own runtime CSS
      { type: 'dom', pattern: 'tailwind-vars', weight: 4, strong: true },
      // Tailwind-only class syntax (md:, hover:, w-[42px], bg-black/50, palette-500)
      { type: 'dom', pattern: 'tailwind-syntax', weight: 3 },
      // Generic utility-class soup (Bootstrap uses flex / p-3 / rounded too): low only
      { type: 'dom', pattern: 'tailwind-utilities', weight: 1 },
    ],
  },
  {
    id: 'bootstrap',
    name: 'Bootstrap',
    category: 'ui',
    checks: [
      { type: 'css', pattern: /(?<![\w-])bootstrap(?:\.min)?\.css$|(?<![\w@.-])(?<!@[\w.-]+\/)bootstrap@\d[\w.-]*\/dist\/css\//i, weight: 4, strong: true },
      // Not a bare bootstrap.js: that name is a common loader file (Clerk ships one)
      { type: 'script', pattern: /(?<![\w-])bootstrap\.bundle(?:\.min)?\.js$|(?<![\w-])bootstrap\.min\.js$|(?<![\w@.-])(?<!@[\w.-]+\/)bootstrap@\d[\w.-]*\/|\/twitter-bootstrap\/\d/i, weight: 4, strong: true },
      { type: 'global', pattern: 'bootstrap', weight: 3, strong: true, runtime: true },
      { type: 'dom', pattern: '.btn-primary', weight: 1 },
    ],
  },
  {
    id: 'mui',
    name: 'MUI (Material UI)',
    category: 'ui',
    checks: [
      { type: 'script', pattern: /(?<![\w-])@mui\/|\/material-ui(?:@|\/)/i, weight: 4, strong: true },
      // Flag token emitted by the content-script probe (which ORs MuiButton/MuiBox)
      { type: 'dom', pattern: '[class*="MuiButton-"]', weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'chakra',
    name: 'Chakra UI',
    category: 'ui',
    checks: [
      { type: 'script', pattern: /(?<![\w-])@chakra-ui\/|\/chakra-ui(?:@|\/)/i, weight: 4, strong: true },
    ],
  },

  // ── Analytics ───────────────────────────────────────────────
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    category: 'analytics',
    checks: [
      { type: 'script', pattern: /google-analytics\.com|googletagmanager\.com\/gtag|gtag\/js/i, weight: 4, strong: true },
      { type: 'global', pattern: 'gtag', weight: 3, strong: true, runtime: true },
      { type: 'cookie', pattern: /^_ga(?:$|_)/, weight: 2 },
    ],
  },
  {
    id: 'segment',
    name: 'Segment',
    category: 'analytics',
    checks: [
      { type: 'script', pattern: /cdn\.segment\.com|analytics\.js\/v1\//i, weight: 4, strong: true },
    ],
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    category: 'analytics',
    checks: [
      { type: 'script', pattern: /cdn\.mxpnl\.com|mixpanel-2-latest|(?:cdn|api-js|api)\.mixpanel\.com/i, weight: 4, strong: true },
      { type: 'global', pattern: 'mixpanel', weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'hotjar',
    name: 'Hotjar',
    category: 'analytics',
    checks: [
      { type: 'script', pattern: /(?:static|script|vars)\.hotjar\.com/i, weight: 4, strong: true },
      { type: 'global', pattern: 'hj', weight: 3, strong: true, runtime: true },
    ],
  },

  // ── Hosting ─────────────────────────────────────────────────
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'hosting',
    checks: [
      { type: 'script', pattern: /vercel\.live|va\.vercel-scripts|_vercel\/insights/i, weight: 4, strong: true },
      { type: 'cookie', pattern: /^__vercel/, weight: 3, strong: true },
      // dpl= deploy query is a strong Next-on-Vercel client hint
      { type: 'script', pattern: /[?&]dpl=dpl_/i, weight: 3, strong: true, matchQuery: true },
    ],
  },
  {
    id: 'netlify',
    name: 'Netlify',
    category: 'hosting',
    checks: [
      { type: 'dom', pattern: '[data-netlify]', weight: 4, strong: true, runtime: true },
      { type: 'cookie', pattern: /^(?:nf_jwt|netlify)/i, weight: 3, strong: true },
      { type: 'script', pattern: /\/\.netlify\/(?:functions|images|scripts)\/|\/_netlify\//i, weight: 2 },
    ],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'hosting',
    checks: [
      // Proxy-only paths. Loading a library from cdnjs does not mean the site is on Cloudflare.
      { type: 'script', pattern: /static\.cloudflareinsights\.com|\/cdn-cgi\/(?:challenge-platform|rum|zaraz|scripts)\//i, weight: 3, strong: true },
      { type: 'cookie', pattern: /^__(?:cf_bm|cfduid)|^(?:cf_clearance)/i, weight: 2 },
    ],
  },

  // ── Architecture / microfrontends ─────────────────────────
  {
    id: 'module-federation',
    name: 'Module Federation',
    category: 'architecture',
    related: ['microfrontend'],
    checks: [
      { type: 'global', pattern: '__FEDERATION__', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__FEDERATION_DEVTOOLS__', weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: '__VMOK__', weight: 3, strong: true, runtime: true }, // module-federation evolved name
      { type: 'script', pattern: /remoteEntry\.(?:js|mjs)(?:[?#]|$)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /@module-federation\//i, weight: 4, strong: true, runtime: true },
      { type: 'inline', pattern: /\b__FEDERATION__\b|remoteEntry\.m?js\b/, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'single-spa',
    name: 'single-spa',
    category: 'architecture',
    related: ['microfrontend'],
    checks: [
      { type: 'global', pattern: 'singleSpa', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'singleSpaNavigate', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)single-spa(?:@|\/|(?:\.min)?\.js$)/i, weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '[data-single-spa]', weight: 3, strong: true, runtime: true },
      { type: 'inline', pattern: /\bsingleSpa\.(?:registerApplication|start|getAppNames)\b/, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'qiankun',
    name: 'qiankun',
    category: 'architecture',
    related: ['microfrontend'],
    checks: [
      { type: 'global', pattern: '__POWERED_BY_QIANKUN__', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__INJECTED_PUBLIC_PATH_BY_QIANKUN__', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)qiankun(?:@|\/|(?:\.umd)?(?:\.min)?\.js$)/i, weight: 3, strong: true, runtime: true },
      { type: 'inline', pattern: /__POWERED_BY_QIANKUN__|\b(?:registerMicroApps|loadMicroApp)\s*\(/, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'systemjs',
    name: 'SystemJS',
    category: 'architecture',
    // Loader only — NOT an MFE framework. Tight paths only (no bare system.js).
    checks: [
      { type: 'dom', pattern: 'script[type="systemjs-importmap"]', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:^|[\/@])systemjs(?:@|\/|\.js)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg\.com|jsdelivr\.net|esm\.sh|cdnjs).*systemjs/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /systemjs\.org|systemjs@[\d.]+/i, weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '__systemjs', weight: 4, strong: true, runtime: true },
    ],
  },
  {
    // Native import maps are common (Vite) — build signal, NOT microfrontend
    id: 'import-map',
    name: 'Import Maps',
    category: 'build',
    checks: [
      { type: 'dom', pattern: 'script[type="importmap"]', weight: 2, runtime: true },
    ],
  },
  // Umbrella — synthesized only from real MFE platforms
  {
    id: 'microfrontend',
    name: 'Microfrontend',
    category: 'architecture',
    checks: [
      { type: 'global', pattern: '__MICRO_FRONTEND__', weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: '__MICROFRONTEND__', weight: 4, strong: true, runtime: true },
    ],
  },

  // ── Build tools (asset / runtime only — no prose) ─────────
  {
    id: 'webpack',
    name: 'Webpack',
    category: 'build',
    checks: [
      { type: 'global', pattern: '__webpack_require__', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'webpackChunk', weight: 4, strong: true, runtime: true }, // probe sets when any webpackChunk* exists
      // webpack runtime / chunk files (webpack-abc123.js, webpack~vendor.js) — not any path containing the word
      { type: 'script', pattern: /(?<![\w-])webpack(?:[~.-][\w.~-]*)?\.m?js$/i, weight: 3, strong: true },
      { type: 'inline', pattern: /\b__webpack_require__\b|\bwebpackJsonp\b/, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'vite',
    name: 'Vite',
    category: 'build',
    checks: [
      { type: 'script', pattern: /\/@vite\/client|\/@react-refresh|\/\.vite\//i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:unpkg|jsdelivr|esm\.sh).*\/vite(?:@|\/)/i, weight: 3, strong: true },
      { type: 'global', pattern: '__vite_plugin_react_preamble_installed__', weight: 4, strong: true, runtime: true },
      { type: 'inline', pattern: /@vite\/client|__vite_is_modern_browser/i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'parcel',
    name: 'Parcel',
    category: 'build',
    checks: [
      { type: 'global', pattern: 'parcelRequire', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)parcel@\d|\/parcel-runtime[\w.-]*\.js$/i, weight: 3, strong: true },
    ],
  },
  {
    id: 'turbopack',
    name: 'Turbopack',
    category: 'build',
    checks: [
      { type: 'script', pattern: /(?<![\w-])turbopack[-_][\w.-]*\.js$/i, weight: 3, strong: true },
      // Case-sensitive: the runtime global is TURBOPACK; the word "Turbopack" in text is not
      { type: 'inline', pattern: /\bTURBOPACK\b|\b__turbopack_[a-z]/, weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: '__turbopack', weight: 4, strong: true, runtime: true },
    ],
  },

  // ── CSS-in-JS (DOM runtime markers only) ──────────────────
  {
    id: 'emotion',
    name: 'Emotion',
    category: 'ui',
    checks: [
      { type: 'dom', pattern: '[data-emotion]', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /@emotion\//i, weight: 4, strong: true },
    ],
  },
  {
    id: 'styled-components',
    name: 'styled-components',
    category: 'ui',
    checks: [
      { type: 'dom', pattern: '[data-styled]', weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '[sc-]', weight: 2 },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)styled-components(?:@|\/)/i, weight: 4, strong: true },
    ],
  },

  // ── Auth (CDN / verified globals only) ────────────────────
  {
    id: 'auth0',
    name: 'Auth0',
    category: 'auth',
    checks: [
      { type: 'script', pattern: /cdn\.auth0\.com|auth0-spa-js|auth0\.min\.js/i, weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'auth0', weight: 3, strong: true, runtime: true }, // probe validates
      { type: 'cookie', pattern: /^auth0\./i, weight: 2 },
    ],
  },
  {
    id: 'clerk',
    name: 'Clerk',
    category: 'auth',
    checks: [
      { type: 'script', pattern: /clerk\.(?:browser|js)|clerk\.accounts|@clerk\//i, weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'Clerk', weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'firebase',
    name: 'Firebase',
    category: 'auth',
    checks: [
      { type: 'script', pattern: /www\.gstatic\.com\/firebasejs|firebasejs\/|firebase-app/i, weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'firebase', weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'nextauth',
    name: 'Auth.js / NextAuth',
    category: 'auth',
    checks: [
      // /api/auth/session is NextAuth's canonical route but not unique to it —
      // plenty of hand-rolled auth uses the same path. Corroborating signal
      // only; the cookie prefix below is the strong proof.
      { type: 'script', pattern: /\/api\/auth\/session$/i, weight: 1 },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)next-auth(?:@|\/)/i, weight: 2 },
      { type: 'cookie', pattern: /^next-auth\./i, weight: 4, strong: true, runtime: true },
    ],
  },

  // ── Payments ──────────────────────────────────────────────
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'payments',
    checks: [
      { type: 'script', pattern: /js\.stripe\.com/i, weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'Stripe', weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    category: 'payments',
    checks: [
      { type: 'script', pattern: /(?:checkout|cdn|api)\.razorpay\.com/i, weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'Razorpay', weight: 4, strong: true, runtime: true },
    ],
  },

  // ── Observability ─────────────────────────────────────────
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'observability',
    checks: [
      { type: 'script', pattern: /browser\.sentry-cdn\.com|js\.sentry-cdn\.com|(?<![\w-])@sentry\/(?:browser|react|vue|angular|nextjs|svelte|tracing|replay|core)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /\.ingest\.(?:[a-z]{2}\.)?sentry\.io\/api\//i, weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'Sentry', weight: 4, strong: true, runtime: true }, // probe validates
      { type: 'global', pattern: '__SENTRY__', weight: 5, strong: true, runtime: true },
    ],
  },
  {
    id: 'datadog',
    name: 'Datadog RUM',
    category: 'observability',
    checks: [
      { type: 'script', pattern: /datadoghq-browser-agent\.com|browser-intake-[\w.-]*datadoghq\.(?:com|eu)|(?<![\w-])datadog-rum(?:-[\w]+)?(?:\.min)?\.js$|(?<![\w-])@datadog\/browser-(?:rum|logs)/i, weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'DD_RUM', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'DD_LOGS', weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'newrelic',
    name: 'New Relic',
    category: 'observability',
    checks: [
      // Browser agent CDN + beacons (solid — never page prose)
      { type: 'script', pattern: /js-agent\.newrelic\.com/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:bam(?:-cell)?\.nr-data\.net|nr-data\.net)/i, weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:^|\/)nr-\d+(?:[.-][\w.-]+)?\.min\.js(?:[?#]|$)/i, weight: 4, strong: true, runtime: true },
      // Runtime objects set by the browser agent
      { type: 'global', pattern: 'NREUM', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'newrelic', weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: '__nr_require', weight: 5, strong: true, runtime: true },
      // Inline snippet: window.NREUM||(NREUM={}) … bam.nr-data.net
      { type: 'inline', pattern: /\bNREUM\b|\b__nr_require\b|bam(?:-cell)?\.nr-data\.net|js-agent\.newrelic\.com/, weight: 5, strong: true, runtime: true },
    ],
  },
  {
    id: 'logrocket',
    name: 'LogRocket',
    category: 'observability',
    checks: [
      { type: 'script', pattern: /(?:cdn|r)\.(?:logrocket\.(?:io|com)|lr-ingest\.(?:io|com)|lr-in(?:-prod)?\.com|lgrckt-in\.com)|(?<![\w@.-])(?<!@[\w.-]+\/)logrocket@\d/i, weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'LogRocket', weight: 4, strong: true, runtime: true },
    ],
  },

  // ── Feature flags & product ───────────────────────────────
  {
    id: 'launchdarkly',
    name: 'LaunchDarkly',
    category: 'analytics',
    checks: [
      { type: 'script', pattern: /(?:app|clientsdk|clientstream|events|sdk)\.launchdarkly\.com|(?<![\w@.-])(?<!@[\w.-]+\/)launchdarkly-js-client-sdk/i, weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'LDClient', weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'intercom',
    name: 'Intercom',
    category: 'analytics',
    checks: [
      { type: 'script', pattern: /widget\.intercom\.io|js\.intercomcdn\.com/i, weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: 'Intercom', weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'intercomSettings', weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    category: 'analytics',
    checks: [
      { type: 'script', pattern: /(?:static|ekr)\.zdassets\.com|\.zendesk\.com\/embeddable/i, weight: 4, strong: true, runtime: true },
      { type: 'global', pattern: 'zE', weight: 3, strong: true, runtime: true },
    ],
  },
  // ── More frameworks (1.8.0) ───────────────────────────────
  {
    id: 'angularjs',
    name: 'AngularJS',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      // AngularJS 1.x: window.angular with module() + bootstrap()
      { type: 'global', pattern: 'angularjs', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w.-])angular(?:\.min)?\.js$/i, weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '[ng-app]', weight: 2 },
    ],
  },
  {
    id: 'astro',
    name: 'Astro',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'dom', pattern: 'astro-island', weight: 5, strong: true, runtime: true },
      // data-astro-cid-* scoped-style attributes are emitted by the Astro compiler
      { type: 'dom', pattern: '[data-astro-]', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /\/_astro\/[\w.-]+\.(?:js|css)$/i, weight: 4, strong: true, runtime: true },
      { type: 'meta', pattern: /^generator=Astro\b/i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'gatsby',
    name: 'Gatsby',
    category: 'framework',
    related: ['react'],
    requiresRuntime: true,
    checks: [
      { type: 'dom', pattern: '#___gatsby', weight: 5, strong: true, runtime: true },
      { type: 'global', pattern: '___gatsby', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /\/page-data\/(?:[\w.-]+\/)*page-data\.json$|\/webpack-runtime-[\da-f]+\.js$/i, weight: 4, strong: true, runtime: true },
      { type: 'meta', pattern: /^generator=Gatsby\b/i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'qwik',
    name: 'Qwik',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: '__qwik', weight: 5, strong: true, runtime: true },
      { type: 'dom', pattern: '[q:container]', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /\/build\/q-[\w-]+\.js$/i, weight: 3, strong: true, runtime: true },
    ],
  },
  {
    id: 'preact',
    name: 'Preact',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: 'preact', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)(?:preact@\d|preact\/dist\/|preact(?:\.module|\.min|\.umd)\.js$)/i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'lit',
    name: 'Lit',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      // lit-element / lit-html push their versions onto window.litElementVersions / litHtmlVersions
      { type: 'global', pattern: 'litVersions', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)lit(?:-element|-html)?@\d/i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'polymer',
    name: 'Polymer',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: 'Polymer', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w-])@polymer\/(?:polymer|lit-element)/i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'ember',
    name: 'Ember',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: 'Ember', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w.-])ember(?:\.prod|\.debug)?(?:\.min)?\.js$/i, weight: 4, strong: true, runtime: true },
    ],
  },
  {
    id: 'alpine',
    name: 'Alpine.js',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: 'Alpine', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)alpinejs@\d|(?<![\w.-])alpine(?:\.min)?\.js$/i, weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '[x-data]', weight: 2 },
    ],
  },
  {
    id: 'htmx',
    name: 'htmx',
    category: 'framework',
    requiresRuntime: true,
    checks: [
      { type: 'global', pattern: 'htmx', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?<![\w@.-])(?<!@[\w.-]+\/)htmx(?:\.org)?@\d|(?<![\w.-])htmx(?:\.min)?\.js$/i, weight: 4, strong: true, runtime: true },
      { type: 'dom', pattern: '[hx-get]', weight: 2 },
    ],
  },

  // ── CMS / site builders ───────────────────────────────────
  {
    id: 'wordpress',
    name: 'WordPress',
    category: 'platform',
    checks: [
      { type: 'meta', pattern: /^generator=WordPress\b/i, weight: 5, strong: true },
      { type: 'script', pattern: /\/wp-(?:content|includes)\/[\w./-]+\.(?:js|css)$/i, weight: 4, strong: true },
    ],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'platform',
    checks: [
      { type: 'global', pattern: 'Shopify', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /cdn\.shopify\.com\/(?:s|shopifycloud|extensions)\//i, weight: 5, strong: true },
    ],
  },
  {
    id: 'webflow',
    name: 'Webflow',
    category: 'platform',
    checks: [
      { type: 'meta', pattern: /^generator=Webflow\b/i, weight: 5, strong: true },
      { type: 'dom', pattern: 'html[data-wf-site]', weight: 5, strong: true },
      { type: 'script', pattern: /(?:assets|uploads-ssl|cdn\.prod)\.website-files\.com\//i, weight: 4, strong: true },
    ],
  },
  {
    id: 'framer',
    name: 'Framer',
    category: 'platform',
    checks: [
      { type: 'meta', pattern: /^generator=Framer\b/i, weight: 5, strong: true },
      { type: 'script', pattern: /framerusercontent\.com\/|events\.framer\.com\//i, weight: 4, strong: true },
      { type: 'dom', pattern: '[data-framer-name]', weight: 3 },
    ],
  },

  // ── More analytics ────────────────────────────────────────
  {
    id: 'posthog',
    name: 'PostHog',
    category: 'analytics',
    checks: [
      { type: 'global', pattern: 'posthog', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /(?:us|eu)(?:-assets)?\.i\.posthog\.com\/|app\.posthog\.com\/|(?<![\w@.-])(?<!@[\w.-]+\/)posthog-js(?:@|\/)/i, weight: 4, strong: true },
    ],
  },
  {
    id: 'plausible',
    name: 'Plausible',
    category: 'analytics',
    checks: [
      { type: 'global', pattern: 'plausible', weight: 4, strong: true, runtime: true },
      { type: 'script', pattern: /plausible\.io\/(?:js|api)\//i, weight: 5, strong: true },
    ],
  },
  {
    id: 'fathom',
    name: 'Fathom',
    category: 'analytics',
    checks: [
      { type: 'global', pattern: 'fathom', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /cdn\.usefathom\.com\//i, weight: 5, strong: true },
    ],
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    category: 'analytics',
    checks: [
      { type: 'global', pattern: 'amplitude', weight: 5, strong: true, runtime: true },
      { type: 'script', pattern: /cdn\.amplitude\.com\/|api2?\.amplitude\.com\/|(?<![\w-])@amplitude\/(?:analytics-browser|unified)/i, weight: 4, strong: true },
    ],
  },
];

/** Platforms that imply microfrontend architecture */
/** Real MFE runtimes only — not SystemJS loader or native import maps */
export const MFE_PLATFORM_IDS = [
  'module-federation',
  'single-spa',
  'qiankun',
];

export const CATEGORY_ORDER = [
  'framework',
  'platform',
  'architecture',
  'build',
  'state',
  'data',
  'ui',
  'auth',
  'payments',
  'observability',
  'analytics',
  'hosting',
];

export const CATEGORY_LABELS = {
  framework: 'Frameworks',
  platform: 'CMS / Site builder',
  architecture: 'Architecture',
  build: 'Build',
  state: 'State',
  data: 'Data',
  ui: 'UI / CSS',
  auth: 'Auth',
  payments: 'Payments',
  observability: 'Observability',
  analytics: 'Analytics & product',
  hosting: 'Hosting / CDN',
};

/** Categories shown first in headline (core stack) */
export const HEADLINE_CATEGORIES = ['framework', 'platform', 'architecture', 'build'];

/** Meta-frameworks that own the page; competitors need independent runtime proof */
export const META_FRAMEWORKS = ['nextjs', 'nuxt', 'sveltekit', 'tanstack-start', 'remix', 'gatsby'];

