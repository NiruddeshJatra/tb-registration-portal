// Emits one static HTML entry per route into dist/, each carrying its own
// title/description/OG image/JSON-LD from seo/pages.json.
//
// Why: the app is a client-side SPA behind a catch-all rewrite, and the
// crawlers that build link previews (Facebook, Twitter/X, WhatsApp) never run
// JS — whatever is in the served HTML head is the preview. Vercel checks the
// filesystem before applying `rewrites`, so dist/register/<slug>/index.html
// wins over the SPA fallback for that URL while still booting the same bundle.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')

const config = JSON.parse(await readFile(path.join(root, 'seo/pages.json'), 'utf8'))
const { baseUrl, pages } = config
const rootPage = pages.find((p) => p.path === '/')

const escape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const expand = (value) =>
  JSON.parse(JSON.stringify(value).replaceAll('{{baseUrl}}', baseUrl))

function head(page) {
  const url = baseUrl + page.path
  const canonical = baseUrl + (page.canonicalPath ?? page.path)
  const image = baseUrl + page.image
  const jsonLd = JSON.stringify(expand(page.jsonLd), null, 2).replace(/\n/g, '\n      ')
  return `<title>${escape(page.title)}</title>
    <meta name="description" content="${escape(page.description)}" />
    <meta property="og:title" content="${escape(page.ogTitle)}" />
    <meta property="og:description" content="${escape(page.ogDescription)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escape(url)}" />
    <meta property="og:image" content="${escape(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:locale:alternate" content="bn_BD" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(page.ogTitle)}" />
    <meta name="twitter:description" content="${escape(page.ogDescription)}" />
    <meta name="twitter:image" content="${escape(image)}" />
    <link rel="canonical" href="${escape(canonical)}" />
    <script type="application/ld+json">
      ${jsonLd}
    </script>`
}

const template = await readFile(path.join(dist, 'index.html'), 'utf8')
const BLOCK = /<!-- SEO:START[\s\S]*?<!-- SEO:END -->/
if (!BLOCK.test(template)) throw new Error('SEO marker block missing from dist/index.html')

for (const page of pages) {
  // `sameAsRoot` pages are the canonical event behind "/" reached by its own
  // slug URL — same meta, own canonical.
  const meta = page.sameAsRoot ? { ...rootPage, ...page } : page
  const html = template.replace(BLOCK, `<!-- SEO:START -->\n    ${head(meta)}\n    <!-- SEO:END -->`)
  const out =
    page.path === '/' ? path.join(dist, 'index.html') : path.join(dist, page.path, 'index.html')
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, html)
  console.log('seo:', page.path, '->', path.relative(root, out))
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .filter((p) => !p.canonicalPath || p.canonicalPath === p.path)
  .map((p) => `  <url><loc>${baseUrl}${p.path}</loc></url>`)
  .join('\n')}
</urlset>
`
await writeFile(path.join(dist, 'sitemap.xml'), sitemap)
