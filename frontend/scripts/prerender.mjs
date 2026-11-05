/* global console -- this file runs in Node. */
// Runs after the Vite build. Writes a ready-made HTML file for each website page, so search engines
// and link previews get the content without running JavaScript. App pages use app.html instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');

// The app reads saved sign-in details as it starts. A build has none.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { renderPage, SEO_IMAGE, SEO_PAGES, SEO_STRUCTURED_DATA, SITE_URL } = await import(
  pathToFileURL(path.join(ssrDir, 'prerender.js')).href
);

const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const replaceOrFail = (html, pattern, replacement) => {
  if (!pattern.test(html)) throw new Error(`prerender: index.html has no match for ${pattern}`);
  return html.replace(pattern, () => replacement);
};

const stripHeadMeta = (html) =>
  html
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '');

const urlOf = (route) => (route === '/' ? `${SITE_URL}/` : `${SITE_URL}${route}`);

for (const [route, { title, description }] of Object.entries(SEO_PAGES)) {
  const body = renderPage(route);
  if (!body.includes('<h1') || body.length < 500) throw new Error(`prerender: ${route} rendered no content`);

  const head = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${urlOf(route)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Account Ledger" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${urlOf(route)}" />`,
    `<meta property="og:image" content="${SEO_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    route === '/' ? `<script type="application/ld+json">${JSON.stringify(SEO_STRUCTURED_DATA)}</script>` : '',
  ].filter(Boolean).join('\n    ');

  let html = stripHeadMeta(shell);
  html = replaceOrFail(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>\n    ${head}`);
  html = replaceOrFail(html, /<html lang="en">/, '<html lang="en" data-prerendered="1">');
  html = replaceOrFail(html, /<div id="root"><\/div>/, `<div id="root">${body}</div>`);

  const file = route === '/' ? path.join(dist, 'index.html') : path.join(dist, route.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// App pages stay out of search results.
fs.writeFileSync(
  path.join(dist, 'app.html'),
  replaceOrFail(stripHeadMeta(shell), /<title>[^<]*<\/title>/, '<title>Account Ledger</title>\n    <meta name="robots" content="noindex" />')
);

// No scripts here, so it stays a plain page whatever address was asked for.
const stylesheet = (shell.match(/<link rel="stylesheet"[^>]*>/) || [''])[0];
const themeScript = (shell.match(/<script>\s*\(function[\s\S]*?<\/script>/) || [''])[0];
fs.writeFileSync(
  path.join(dist, '404.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Page not found | Account Ledger</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
    ${themeScript}
    ${stylesheet}
  </head>
  <body>
    <main class="min-h-screen bg-site-sunken text-ink flex flex-col items-center justify-center p-6 text-center">
      <h1 class="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p class="mt-2 text-ink-2">This address doesn't exist.</p>
      <a href="/" class="mt-5 text-sm font-medium text-accent hover:underline">Go to the home page</a>
    </main>
  </body>
</html>
`
);

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(SEO_PAGES).map((route) => `  <url><loc>${urlOf(route)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`
);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

fs.rmSync(ssrDir, { recursive: true, force: true });
console.log(`Prerendered ${Object.keys(SEO_PAGES).length} pages, app.html, 404.html, sitemap.xml and robots.txt.`);
