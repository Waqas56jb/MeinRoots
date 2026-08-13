# MeinRoots

International recruitment platform: candidates upload a CV, AI structures it into a
profile, identifies their professional domain and skill gaps, and scores how ready they
are for work in Germany, remote work, freelance or an Ausbildung.

**Milestone 1 — candidate platform & AI qualification MVP.**

| Folder | What it is | Deployed at |
| --- | --- | --- |
| [client/](client/) | Candidate site: landing page, auth, CV upload, dashboard, questionnaire | `http://169.58.169.182` |
| [admin/](admin/) | Internal review console: queue, candidate review, jobs, audit log | `http://169.58.169.182:8443` |
| [server/](server/) | Node.js + Express API, PostgreSQL, OpenAI pipeline, background worker | `/api` on both |

**The console is on its own origin and nothing links to it.** The candidate site
has no admin link, no admin route, and no admin code in its bundle — `/admin`
there returns 404. A candidate cannot discover the console from the site. See
[admin/README.md](admin/README.md) for what that isolation does and does not
guarantee, and how to lock it down further.

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
