# MeinRoots — Client

Front end for the MeinRoots recruitment platform: landing page, the full auth flow, the
gated CV upload, the candidate dashboard and the admin review console.

React 18 + Vite + React Router, plain JavaScript, hand-written CSS (no UI framework)
and Lucide icons via react-icons. White-and-blue theme derived from the logo.

## Run

```bash
cd client
cp .env.example .env   # point VITE_API_URL at the API
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the production build
```

The API must be running too — see [../server/README.md](../server/README.md).

## Talking to the API

Everything goes through [`src/lib/api.js`](src/lib/api.js); nothing else calls `fetch`.
That one file owns three things that are easy to get subtly wrong in several places:

- **Cookies are always sent** (`credentials: 'include'`). The session is two httpOnly
  cookies set by the API, so no script — including an injected one — can read the tokens.
- **An expired access token refreshes once, transparently.** Concurrent 401s share a
  single refresh; four parallel dashboard requests would otherwise rotate the refresh
  token four times and invalidate their own session.
- **Failures arrive as an `ApiError` with a stable `code`.** The UI renders in three
  languages, so it translates the code itself via `useApiMessage` and never displays the
  server's English message.

`VITE_API_URL` may be set to an empty string, which means same-origin — the deployment
where nginx serves this build and proxies `/api` to the Node process.

## Deploying to Vercel

1. **New Project → import the repo.**
2. Set **Root Directory** to `client` (the repo root also holds `server/`, `admin/`,
   `super-admin/`).
3. Framework preset **Vite**, build `npm run build`, output `dist` — [vercel.json](vercel.json)
   already declares all of this, so the defaults it detects will be correct.
4. Deploy.

### Why refreshing a page used to 404 — and why it no longer does

This is a single-page app: the server only ever has **one** real HTML file, `dist/index.html`.
React Router draws `/login`, `/signup` and `/reset-password` in the browser; those paths do
not exist as files on disk.

- Clicking a link → the router swaps the view in JS. Fine.
- **Refreshing** `/login` (or pasting the URL, or opening it in a new tab) → the browser asks
  the server for a file at `/login`. On a plain static host there is nothing there → **404**.

Measured on this build, served without a fallback:

```
200  /            404  /login      404  /signup
404  /upload      404  /reset-password
```

The fix is the `rewrites` block in `vercel.json`: any path that is not a real file is served
`index.html`, and the router then reads the URL and renders the right page. Same build, with
the fallback:

```
200  /   200  /login   200  /signup   200  /reset-password
200  /upload   200  /some/deep/unknown/path   200  /logo.png
```

Two details that matter:

- The rewrite pattern is `/((?!assets/).*)` — it deliberately **excludes `/assets/`** so a
  missing JS or CSS chunk returns a real 404 instead of silently returning HTML (a bug that
  shows up as `Uncaught SyntaxError: Unexpected token '<'`).
- Real files still win: `/logo.png` and `/robots.txt` are served from disk, not rewritten.

### What else `vercel.json` sets

| Setting | Why |
| --- | --- |
| `assets/*` → `max-age=31536000, immutable` | Filenames are content-hashed (`index-D1j7_W6h.js`), so a changed file gets a new name. Caching forever is safe and makes repeat visits instant. |
| `index.html` → `max-age=0, must-revalidate` | The one file that must never be stale, otherwise users keep loading old asset names after a deploy. |
| `X-Content-Type-Options: nosniff` | Stops browsers guessing a file's type. |
| `X-Frame-Options: SAMEORIGIN` | Blocks clickjacking via `<iframe>`. |
| `Referrer-Policy: strict-origin-when-cross-origin` | Stops full URLs leaking to third parties. |
| `Permissions-Policy` | Denies camera / mic / geolocation outright. |
| `Strict-Transport-Security` | Forces HTTPS on repeat visits. |

### Optional: Content-Security-Policy

Not enabled by default because a wrong CSP breaks the site silently. When you're ready, add
this header and test on a preview deployment first — these are the only external origins the
app uses:

```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
}
```

If you later add Vercel Analytics, a backend API or a payment provider, their domains must be
added to `script-src` / `connect-src` or they will be blocked.

### Before you point a real domain at it

- The Unsplash photos are hotlinked from their CDN. Fine for a demo; for production, license
  or self-host the images and drop them in `public/`.
- Update the `Sitemap:` line in [public/robots.txt](public/robots.txt) and the `og:image` /
  canonical URL in [index.html](index.html) to the real domain.
- The placeholder figures ("40+ countries", "82% need no manual review", the €19/€15 pricing)
  are unconfirmed — replace or remove them before launch.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | public | Landing page |
| `/login` | public | Log in — accepts `?next=` and `?gate=cv` |
| `/signup` | public | Create account — accepts `?email=` and `?next=` |
| `/reset-password` | public | Request a reset link; with `?token=` it becomes the "choose a new password" form |
| `/verify-email` | public | Opened from the confirmation email; verifies once, signed in or out |
| `/dashboard` | **protected** | Overview: completeness, readiness, next steps |
| `/cv` | **protected** | Upload, analysis progress, the original file and its three language versions |
| `/profile` | **protected** | The structured profile, fully editable |
| `/readiness` | **protected** | Readiness per objective with its factors and skill gaps |
| `/recommendations` | **protected** | What to do next, derived from the candidate’s own data |
| `/questionnaire` | **protected** | The questions the CV could not answer, one at a time |
| `/settings` | **protected** | Account, language, objectives, notifications, password, erasure |
| `/upload` | — | Redirects to `/cv`; kept so older links still land somewhere |

`Protected` waits for the session check before deciding anything — redirecting while
`/auth/me` is still in flight would bounce a signed-in user off their own dashboard on
every refresh.

There is no admin route here, and no link to one anywhere in this application. The
[review console](../admin/README.md) is a separate app on a separate origin
(`:8443`); none of it — not even behind a role check — is part of what a candidate
downloads, and `/admin` on this origin returns 404. A candidate must not be able to
discover that a review tool exists, let alone find its address.

## The CV upload rule

A CV is personal data, so it can only be uploaded by a signed-in candidate. Every
"upload your CV" control on the public site — navbar, hero, goal cards, languages
section, CTA dropzone — routes through one hook, [`useCvGate`](src/hooks/useCvGate.js):

```
signed in      → /upload
not signed in  → /login?next=/upload&gate=cv
                 ├─ the login page shows the "one step before your CV" notice
                 ├─ "create a free account" carries ?next through to /signup
                 └─ after login or signup → /upload
```

`/upload` is independently protected by the `Protected` wrapper in [App.jsx](src/App.jsx),
so typing the URL directly bounces to the same gate. The CTA email field short-circuits
to `/signup?email=…` so the address is never typed twice.

Auth runs against the API ([AuthContext](src/context/AuthContext.jsx)). Nothing is kept in
`localStorage` except the chosen language — the session lives entirely in httpOnly cookies
and the user object is re-fetched on mount rather than trusted from storage.

## Languages

🇬🇧 English (default) · 🇩🇪 Deutsch · 🇫🇷 Français — real translations, not placeholders.
Every visible string on every page comes from [`src/i18n/`](src/i18n/), including skip
links, aria-labels, button titles and validation messages.

- The switcher lives in the navbar, the mobile drawer, the footer and every auth page.
- **English is the default for every visitor.** Only an explicit choice from the switcher
  changes it, and that choice persists in `localStorage`; the browser's own language is
  deliberately ignored.
- `<html lang>`, the tab title and the meta description update with the language.
- `de.js` and `fr.js` mirror `en.js` key for key — verified: same keys, same value types,
  same array lengths.
- The `EN · DE · FR` chips shown next to CV uploads render from `localeCodes` in
  [`src/i18n/index.js`](src/i18n/index.js), so they can never drift from the registry.

Adding a language: copy `en.js`, translate the values, register it in
[`src/i18n/index.js`](src/i18n/index.js). Nothing else needs to change.

## The workspace

Everything behind the login shares one shell and one data layer.

`AppShell` renders three layouts from one markup: a labelled sidebar at ≥1180px, an
icon-only sidebar below that, and a drawer under 900px. The collapse choice persists.

`WorkspaceContext` loads the profile, the current CV and the questionnaire **once** for
all six pages, and polls only while an analysis is actually running — an idle dashboard
makes no requests at all. Before this, each page fetched its own copy and ran its own
polling loop against the others.

`buildRecommendations` derives the "next steps" list from real data only: a field that is
genuinely empty, a question genuinely unanswered, or a gap the assessment itself produced.
Every item links somewhere that can actually resolve it — there are no buttons that do
nothing, and nothing on that page is invented to fill space.

## Structure

```
client/
├── public/logo.png
├── index.html
└── src/
    ├── main.jsx                 # Router + I18nProvider + AuthProvider
    ├── App.jsx                  # routes, Protected wrapper, scroll reset
    ├── pages/                   # Landing, Login, Signup, ResetPassword, Upload,
    │                            # Dashboard, Questionnaire, Admin, AdminCandidate
    ├── context/
    │   ├── I18nContext.jsx      # t(), RichText, locale persistence
    │   └── AuthContext.jsx      # signup / login / logout / reset, backed by the API
    ├── lib/
    │   ├── api.js               # the only place that calls fetch
    │   ├── apiMessage.js        # error code → translated sentence
    │   └── markdown.js          # escapes, then renders, the AI CV versions
    ├── i18n/                    # en, de, fr + registry & locale resolution
    ├── data/content.js          # structural data only (icons, ids, tones, images)
    ├── hooks/
    │   ├── useCvGate.js         # the upload rule
    │   ├── useReveal.js         # scroll reveal + scroll position
    │   └── useCountUp.js        # stat counters
    ├── components/
    │   ├── ui/                  # Icon (Lucide map), SmartImage, Reveal, Spinner, EmptyState
    │   ├── auth/                # AuthShell, Field, PasswordMeter
    │   ├── app/                 # AppHeader, ReadinessCard, ProfileBlocks, CvVersions
    │   ├── Navbar · Hero · TrustBar · Goals · HowItWorks · Features
    │   ├── Domains · Gallery · Languages · HumanLoop · Testimonials
    │   └── Pricing · Faq · CallToAction · Footer · ScrollTop · LanguageSwitcher
    └── styles/
        ├── global.css           # tokens, reset, buttons, cards, grid, reveal
        ├── sections.css         # landing sections + breakpoints
        ├── auth.css             # auth pages + upload screen
        └── app.css              # dashboard, questionnaire, admin console
```

## Where it is deployed

`http://169.58.169.182` — nginx on the Contabo box serves this build and proxies `/api`
to the Node process, so the front end and API are one origin. The review console is a
different origin on the same box and is not reachable from here.

The Vercel deployment cannot talk to that API yet: Vercel is HTTPS and the API is still
plain HTTP, so the browser blocks the request as mixed content. Once a domain and a
certificate are in place, either host works.

## Theme

All tokens sit on `:root` in [global.css](src/styles/global.css) — `--brand` (#2563eb),
`--brand-sky` (#29a9f5), `--brand-grad`, neutrals, radii, shadows, section rhythm.
Change them there and the whole app follows.

## Responsiveness

Breakpoints at 1240 / 1080 / 980 / 780 / 620 / 460 px cover desktop, tablet, Android and
iOS phones. Includes `100dvh` for mobile browser chrome, `env(safe-area-inset-*)` for
notched iPhones, `viewport-fit=cover`, a scroll-locked drawer, 44px+ touch targets, and
full `prefers-reduced-motion` support (every ambient animation stops).

## Images

Photos stream live in HD from the Unsplash CDN, sized per slot (`auto=format&q=80`).
`SmartImage` fades them in and falls back to a brand-blue gradient tile if a request is
blocked, so the layout never breaks offline.

## Not built yet

Job aggregation and matching, recruiter and candidate subscriptions, payments, messaging,
employer access, courses and relocation support — all Milestone 2. The pricing table on
the landing page is still indicative, and the placeholder figures ("40+ countries", the
€19/€15 tiers) are unconfirmed — they need real content from MeinRoots before launch.

## Web fundamentals checklist

Rules this project already follows, and the reasoning — useful as a baseline for the
admin, super-admin and server apps too.

### Routing & deployment
- **Every URL must survive a refresh.** SPA host → rewrite unknown paths to `index.html`.
- **Never rewrite `/assets/`.** A missing chunk must 404, not return HTML.
- **Hashed filenames + long cache; `index.html` never cached.**
- **One canonical URL.** Pick `https://` + one of www/non-www and 301 the rest.

### Security
- **HTTPS only**, with HSTS.
- **Security headers**: `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
  and a CSP once tested.
- **Never trust the client.** The `/upload` guard here is UX only — the real check belongs in
  the API. Client-side validation is a convenience; server-side validation is the rule.
- **No secrets in the bundle.** Anything in `VITE_*` is public. API keys live on the server.
- **Don't leak account existence.** Password reset always reports success — see
  `requestReset` in [AuthContext.jsx](src/context/AuthContext.jsx).
- **Tokens**: httpOnly, Secure, SameSite cookies from the API. `localStorage` (used here for
  the mock) is readable by any injected script.

### Accessibility
- One `<h1>` per page, headings in order, real landmarks (`header`/`main`/`footer`/`nav`).
- Every control reachable and operable by keyboard; visible `:focus-visible` ring.
- Labels on every input; errors linked with `aria-describedby`.
- `alt=""` on decorative images, descriptive `alt` on meaningful ones.
- Text contrast ≥ 4.5:1 — the two bugs fixed here (white icon on white, grey text on blue)
  were exactly this failure.
- Honour `prefers-reduced-motion`.
- A skip-to-content link as the first focusable element.

### Performance
- Ship images at the size they render, in a modern format, with `width`/`height` or
  `aspect-ratio` so the layout doesn't jump (CLS).
- `loading="lazy"` below the fold, `eager` + preload for the hero.
- Keep the initial JS small; code-split routes as the app grows.
- Self-host or `preconnect` fonts; use `display=swap`.
- Watch the three Core Web Vitals: **LCP** < 2.5s, **INP** < 200ms, **CLS** < 0.1.

### Correctness & UX
- Mobile-first, test at 360px, 768px, 1280px and 1920px.
- Respect safe-area insets on notched phones; use `100dvh`, not `100vh`.
- Every async action needs three states: loading, empty, error.
- Forms: correct `type` and `autocomplete`, inline validation, never lose typed input.
- Touch targets ≥ 44×44px.

### Content & SEO
- Unique `<title>` and meta description per page; Open Graph image for sharing.
- `<html lang>` must match the language actually rendered — it does here, and it changes with
  the switcher.
- `robots.txt` + sitemap; keep transactional pages out of the index.

### Legal (EU/Germany — relevant for this product)
- GDPR: lawful basis, privacy notice, retention and deletion, data-subject rights.
- A cookie banner is required *before* setting non-essential cookies or analytics.
- An **Impressum** is legally mandatory for a German commercial site.
- Consent must be captured before sharing candidate data with a recruiter.

### Operations
- Error tracking (Sentry or similar) and uptime monitoring from day one.
- Preview deployment for every PR; never test only in production.
- Automated backups of anything users can't recreate.
