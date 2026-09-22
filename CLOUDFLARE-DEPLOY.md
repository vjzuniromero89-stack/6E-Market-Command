# Cloudflare deploy

This repository is configured for Next.js on Cloudflare Workers using OpenNext.

Cloudflare Builds settings:
- Root directory: `/`
- Build command: `npm run cf:build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`

The first install will generate dependencies from package.json. After a successful local `npm install`, commit the generated package-lock.json if desired.

Required runtime secrets/variables should be added in Cloudflare project settings; never commit real tokens.
