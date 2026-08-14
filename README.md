# MeinRoots

International recruitment platform: candidates upload a CV, AI structures it into a
profile, identifies their professional domain and skill gaps, and scores how ready they
are for work in Germany, remote work, freelance or an Ausbildung.

**Milestone 1 — candidate platform & AI qualification MVP.**

| Folder | What it is | Deployed at |
| --- | --- | --- |
| [client/](client/) | Candidate workspace: landing page, auth, CV upload, profile, readiness, questionnaire | **https://meinroots.de** |
| [admin/](admin/) | Internal review console: queue, candidate review, jobs, audit log | **https://admin.meinroots.de** |
| [server/](server/) | Node.js + Express API, PostgreSQL, OpenAI pipeline, background worker | `/api` on both hostnames |

**The console is on its own hostname and nothing links to it.** The candidate site
has no admin link, no admin route, and no admin code in its bundle — `/admin` there
returns 404. Because the hostnames differ, the session cookies are host-only: a
candidate's cookie is never sent to the console's origin, and vice versa.

Everything is HTTPS with HSTS; plain HTTP redirects. The console hostname is not a
secret — every certificate is published to Certificate Transparency logs — so see
[admin/README.md](admin/README.md) for how to put a real second gate in front of it.

All three interfaces are EN/DE/FR, and every dictionary is verified key-for-key
against English.

Each folder has its own README with setup, decisions and deployment notes.

## Running the whole thing locally

```bash
# API — needs PostgreSQL and an OpenAI key
cd server && cp .env.example .env && npm install && npm run migrate && npm run dev

# Candidate site
cd client && npm install && npm run dev     # http://localhost:5173

# Review console
cd admin && npm install && npm run dev      # http://localhost:5174
```

Create an admin account for the console:

```bash
cd server && npm run create-admin "Your Name" you@meinroots.com 'a-real-password' --super
```

## Deployed

Everything runs on the Contabo box behind one nginx origin, so the session cookies
are first-party for both interfaces.

See [server/README.md](server/README.md) for the service layout and what still has to
happen before launch — TLS being the first item.
