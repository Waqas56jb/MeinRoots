# MeinRoots — Review console

Internal tool for the MeinRoots team. A separate application from the candidate
site, on a **separate origin**.

React 18 + Vite + React Router, plain JavaScript, hand-written CSS, Lucide icons.
Trilingual (EN/DE/FR) like the rest of the platform.

## Where it lives

| | |
| --- | --- |
| Candidate site | `http://169.58.169.182` |
| **Review console** | **`http://169.58.169.182:8443`** |

Nothing connects the two. The candidate site has no admin link, no admin route
and no admin code in its bundle; `/admin` and the usual guesses (`/administrator`,
`/backend`, `/console`, `/wp-admin`) all return a flat **404** there. The console
links back to nothing either. A candidate cannot discover from the site that a
review tool exists, let alone where.

## Isolation — what this does and does not give you

**It does:** remove every path from the public site to the console; put the
console on its own origin with its own document root, its own security headers
(`X-Frame-Options: DENY`, `noindex`, `no-referrer`) and its own access rules;
keep the console out of the candidate bundle entirely.

**It does not:** separate the two cryptographically. A different port is a
different origin for CORS, but **cookies ignore ports** — a session cookie set on
this host is sent to both. That is safe here because the API authorises every
admin route by role on the server, never by which port asked, but it is worth
stating plainly rather than implying more than is true.

**Full isolation** is a separate hostname with its own certificate
(`admin.meinroots.com`), available the moment a domain exists. See below.

### Restricting access further

Both are nginx-level, in the `:8443` block of
[`../server/deploy/nginx.conf`](../server/deploy/nginx.conf) — no code change:

```nginx
# Only your office/home IP can even reach the login form
allow 203.0.113.4;
deny all;

# Or a second password in front of the app
auth_basic "MeinRoots";
auth_basic_user_file /etc/nginx/.meinroots-admin;
```

## Run

```bash
cd admin
npm install
npm run dev      # http://localhost:5174
npm run build    # → dist/
```

`vite.config.js` proxies `/api` to `http://localhost:4000` in development, so the
browser stays on one origin and the session cookies behave exactly as they do in
production — no CORS or SameSite exceptions to remember.

## Deploying it somewhere else

The app is origin-agnostic: nothing hardcodes a path. `base` comes from
`ADMIN_BASE` (default `/`) and React Router reads the same value through
`import.meta.env.BASE_URL`, so the two can never disagree.

```bash
npm run build                      # served at the root of its own host/port
ADMIN_BASE=/tools/ npm run build   # served under a subpath
```

**On Vercel or another host**, the console and the API are then on different
origins, which needs two things:

1. `VITE_API_URL=https://api.meinroots.com` at build time.
2. That address in `CORS_ORIGINS` in the API's `.env`.

And one prerequisite that is not optional: **the API must be on HTTPS first.**
A page served over HTTPS cannot call a plain-HTTP API — the browser blocks it as
mixed content, and the cookies would be cross-site. So: domain → certificate →
then Vercel. Until then, the port-8443 deployment is the working one.

## Why it is not part of the client app

1. **Nothing from the console ships to candidates.** A candidate does not receive
   the review queue, the audit log or the erasure dialog — not even as dead code
   behind a role check.
2. **Different job, different interface.** The candidate site is a wide, animated
   marketing page. This is a dense operations tool.
3. **They can be deployed and secured separately** — which is exactly what the
   separate origin above is for.

## Screens

| Route | What it answers |
| --- | --- |
| `/` | How much of the intake cleared itself, and what is waiting |
| `/candidates` | Which profiles need a decision — filter by status, objective, domain, open flags |
| `/candidates/:id` | Everything about one candidate, and the three buttons that end the review |
| `/queue` | Background analysis jobs; retry anything that gave up |
| `/audit` | Who did what to candidate data, and from where |

The candidate detail page is tabbed (profile, readiness, answers, documents,
history) with the decision panel pinned above the tabs — status, confidence, GDPR
consent, open exceptions and the approve/flag/reject buttons are visible without
scrolling, because that is the whole job.

## Responsiveness

Three layouts from one markup:

| Width | Layout |
| --- | --- |
| ≥1100px | Fixed navy sidebar + content |
| <1100px | Sidebar becomes a slide-in drawer behind a burger |
| <760px | Plus a bottom tab bar — where a thumb actually reaches |
| <900px | The candidate table becomes a list of cards |

A seven-column table cannot be made readable at 390px by shrinking it, so it is
not shrunk — the same rows render as cards instead.

iOS and Android specifics that are easy to miss and are handled here:

- `viewport-fit=cover` with `env(safe-area-inset-*)` padding, so the sidebar
  clears the notch and the tab bar clears the home indicator.
- `100dvh`, not `100vh` — mobile browser chrome changes the viewport height.
- Every input is `16px`, below which iOS Safari zooms the page on focus.
- Touch targets are at least 44px.
- The body is scroll-locked while the drawer is open, otherwise iOS scrolls the
  page underneath it.
- Closed drawer is `visibility: hidden`, not just translated off-screen, so its
  links are not focusable.
- `prefers-reduced-motion` disables every animation.

## Access

Sign in with an admin account created via the API's CLI:

```bash
cd ../server
npm run create-admin "Name" you@meinroots.com 'password' --super
```

A non-admin who signs in here is signed straight back out — the console refuses
to hold a candidate session. `super_admin` additionally sees the GDPR erasure
panel, which requires typing the candidate's email address to confirm, because a
yes/no dialog is muscle memory and retyping an address is not.

Every action taken here is written to the audit log, including simply opening a
candidate's record.
