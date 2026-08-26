---
allowed-tools: Read, Edit, Bash
argument-hint: [--bundle] [--images] [--pwa] [--all]
description: Next.js 16 (Turbopack) performance audit tailored to this project, with actionable recommendations
---

## Next.js Performance Audit

**Audit Type**: $ARGUMENTS

Note: this project builds with **Turbopack**, not webpack — ignore any generic advice that assumes a webpack config.

## Current Application Analysis

- Build status: !`ls -la .next/ 2>/dev/null || echo "No build found — run 'npm run build' first"`
- Next.js config: @next.config.ts
- Package.json: @package.json
- Service worker: @public/sw.js (this app is an installable PWA — check it doesn't cache HTML/RSC responses)

## Task

1. **Bundle size** — run `npm run build` and inspect the route summary Next.js prints (First Load JS per route). Flag any route noticeably larger than its neighbours and suggest `next/dynamic` for non-critical client components.

2. **Images** — grep for raw `<img>` tags outside of `next/image` (the codebase currently has a few, flagged by `@next/next/no-img-element`); decide case by case whether `next/image` is worth it (e.g. the tiny 96×96 splash icon in `app/layout.tsx` intentionally isn't, since it must render before Next's image pipeline is ready).

3. **PWA / service worker** — verify `public/sw.js` only caches content-hashed static assets (`/_next/static/`, `/images/`, fonts, icons) and never documents or `_rsc` requests — caching HTML across deploys is what caused the "This page couldn't load" regression earlier in this project. Check `CACHE_NAME` gets bumped whenever the caching logic changes.

4. **Fonts** — this project loads Bricolage Grotesque via `next/font/google`, self-hosted automatically. Confirm no additional font is loaded via a `<link>` tag that would add an extra render-blocking request.

5. **Core Web Vitals sanity check** — since this app targets users on flaky mobile data in Mozambique, prioritize: fast Time to Interactive over marginal LCP polish, and confirm the `proxy.ts` rate limiter doesn't count Next.js prefetch/RSC requests (it shouldn't — this was already fixed once).

**Output**: A short, prioritized list of concrete changes (file + line references), not a generic checklist. Skip advice that doesn't apply to a Turbopack + Vercel + Supabase stack.
