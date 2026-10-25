import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'

const root = process.cwd()
const iconsDir = path.join(root, 'icons')
const outputDir = path.join(root, '_site')
const originalUrl = 'https://primer-docs-preview.github.com/octicons/'
const originalOrigin = 'https://primer-docs-preview.github.com'
const publicOrigin = 'https://primer.style'

function iconName(filename) {
  const match = filename.match(/^(.*)-(\d+)\.svg$/)
  return match ? {name: match[1], size: Number(match[2])} : null
}

function upstreamIconFiles() {
  execFileSync(
    'git',
    ['fetch', '--depth=1', 'https://github.com/primer/octicons.git', 'main'],
    {stdio: 'ignore'},
  )

  return new Set(
    execFileSync(
      'git',
      ['ls-tree', '-r', '--name-only', 'FETCH_HEAD', '--', 'icons'],
      {encoding: 'utf8'},
    )
      .split('\n')
      .filter(Boolean)
      .map(file => path.basename(file)),
  )
}

function rewriteUrls(html) {
  return html
    .replace(
      /\b(href|src|action)=("|')\/(?!\/)/g,
      (_, attr, quote) => attr + '=' + quote + publicOrigin + '/',
    )
    .replaceAll(originalOrigin, publicOrigin)
    .replace(/\bsrcset=("|')([^"']+)\1/g, (_, quote, value) => {
      const rewritten = value
        .split(',')
        .map(part => {
          const pieces = part.trim().split(/\s+/)
          if (pieces[0].startsWith('/') && !pieces[0].startsWith('//')) {
            pieces[0] = publicOrigin + pieces[0]
          } else if (pieces[0].startsWith(originalOrigin)) {
            pieces[0] = publicOrigin + pieces[0].slice(originalOrigin.length)
          }
          return pieces.join(' ')
        })
        .join(', ')
      return 'srcset=' + quote + rewritten + quote
    })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function cardSvg(name, size) {
  const raw = fs.readFileSync(path.join(iconsDir, name + '-' + size + '.svg'), 'utf8')
  const viewBox = raw.match(/\bviewBox=(["'])(.*?)\1/)?.[2] ?? ('0 0 ' + size + ' ' + size)
  const body = raw
    .replace(/^<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim()

  return (
    '<svg width="24" height="24" viewBox="' +
    escapeHtml(viewBox) +
    '" fill="currentColor" aria-hidden="true">' +
    body +
    '</svg>'
  )
}

function injectCustomCards(html, customIcons) {
  if (!customIcons.length) return html

  const labelToken = '>stack-slash</span>'
  const tokenIndex = html.indexOf(labelToken)
  if (tokenIndex < 0) {
    throw new Error('Unable to locate the Octicons Uncategorized insertion point')
  }

  const spanStart = html.lastIndexOf('<span', tokenIndex)
  const spanEnd = tokenIndex + labelToken.length
  const anchorEnd = html.lastIndexOf('</a>', spanStart) + 4
  const anchorStart = html.lastIndexOf('<a', anchorEnd)

  if (spanStart < 0 || anchorStart < 0 || anchorEnd < 4) {
    throw new Error('Unable to locate the stack-slash card structure')
  }

  const referenceAnchor = html.slice(anchorStart, anchorEnd)
  const referenceLabel = html.slice(spanStart, spanEnd)

  const additions = customIcons
    .map((icon, index) => {
      const size = icon.sizes.includes(16) ? 16 : icon.sizes[0]
      const labelId = 'custom-octicon-label-' + index + '-' + icon.name

      const anchor = referenceAnchor
        .replace(/aria-labelledby="[^"]+"/, 'aria-labelledby="' + labelId + '"')
        .replace(
          /href="[^"]+"/,
          'href="#' +
            escapeHtml(icon.name) +
            '" data-custom-octicon="' +
            escapeHtml(icon.name) +
            '"',
        )
        .replace(/<svg\b[\s\S]*?<\/svg>/, cardSvg(icon.name, size))

      const label = referenceLabel
        .replace(/id="[^"]+"/, 'id="' + labelId + '"')
        .replace('>stack-slash</span>', '>' + escapeHtml(icon.name) + '</span>')

      return anchor + label
    })
    .join('')

  return html.slice(0, spanEnd) + additions + html.slice(spanEnd)
}

fs.rmSync(outputDir, {recursive: true, force: true})
fs.mkdirSync(outputDir, {recursive: true})
fs.cpSync(iconsDir, path.join(outputDir, 'icons'), {recursive: true})

const localFiles = fs
  .readdirSync(iconsDir)
  .filter(filename => iconName(filename))
  .sort()

const upstreamFiles = upstreamIconFiles()
const keywords = JSON.parse(fs.readFileSync(path.join(root, 'keywords.json'), 'utf8'))

const grouped = new Map()
for (const filename of localFiles) {
  const parsed = iconName(filename)
  if (!parsed) continue

  const entry = grouped.get(parsed.name) ?? {
    name: parsed.name,
    sizes: [],
    custom: false,
  }

  entry.sizes.push(parsed.size)
  if (!upstreamFiles.has(filename)) entry.custom = true
  grouped.set(parsed.name, entry)
}

const icons = [...grouped.values()]
  .map(icon => ({
    ...icon,
    sizes: [...new Set(icon.sizes)].sort((a, b) => a - b),
    keywords: keywords[icon.name] ?? [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const customIcons = icons.filter(icon => icon.custom)

const response = await fetch(originalUrl)
if (!response.ok) {
  throw new Error('Failed to fetch original Octicons page: ' + response.status)
}

let html = await response.text()

// Keep Primer's server-rendered markup and styles. The private Primer Docs
// runtime is intentionally omitted; the lightweight client below handles
// search, theme switching and custom-icon details on GitHub Pages.
html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
html = rewriteUrls(html)
html = injectCustomCards(html, customIcons)

const styleTag = '<link rel="stylesheet" href="./pages-custom.css">'
const scriptTag = '<script src="./pages-client.js" defer></script>'

html = html.replace('</head>', styleTag + '\n</head>')
html = html.replace('</body>', scriptTag + '\n</body>')

const manifest = {
  generatedAt: new Date().toISOString(),
  originalUrl,
  icons,
}

fs.writeFileSync(path.join(outputDir, 'index.html'), html)
fs.writeFileSync(
  path.join(outputDir, 'octicons-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
)
fs.copyFileSync(
  path.join(root, 'script/pages-client.js'),
  path.join(outputDir, 'pages-client.js'),
)
fs.copyFileSync(
  path.join(root, 'script/pages-custom.css'),
  path.join(outputDir, 'pages-custom.css'),
)
fs.writeFileSync(path.join(outputDir, '.nojekyll'), '')

console.log('Mirrored original Octicons page')
console.log('Icons:', icons.length)
console.log(
  'Custom icons:',
  customIcons.length ? customIcons.map(icon => icon.name).join(', ') : '(none)',
)
console.log(
  'Custom cards in HTML:',
  customIcons.filter(icon => html.includes('data-custom-octicon="' + icon.name + '"')).length,
)
