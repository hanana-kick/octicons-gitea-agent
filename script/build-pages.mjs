import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'

const root = process.cwd()
const iconsDir = path.join(root, 'icons')
const outputDir = path.join(root, '_site')
const originalUrl = 'https://primer-docs-preview.github.com/octicons/'
const originalOrigin = 'https://primer-docs-preview.github.com'

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

function rewriteRootRelativeUrls(html) {
  return html
    .replace(
      /\b(href|src|action)=("|')\/(?!\/)/g,
      (_, attr, quote) => attr + '=' + quote + originalOrigin + '/',
    )
    .replace(/\bsrcset=("|')([^"']+)\1/g, (_, quote, value) => {
      const rewritten = value
        .split(',')
        .map(part => {
          const trimmed = part.trim()
          const pieces = trimmed.split(/\s+/)
          if (pieces[0].startsWith('/') && !pieces[0].startsWith('//')) {
            pieces[0] = originalOrigin + pieces[0]
          }
          return pieces.join(' ')
        })
        .join(', ')
      return 'srcset=' + quote + rewritten + quote
    })
}

fs.rmSync(outputDir, {recursive: true, force: true})
fs.mkdirSync(outputDir, {recursive: true})
fs.cpSync(iconsDir, path.join(outputDir, 'icons'), {recursive: true})

const response = await fetch(originalUrl)
if (!response.ok) {
  throw new Error('Failed to fetch original Octicons page: ' + response.status)
}

let html = await response.text()

// Keep the exact server-rendered Primer page and its styles, but avoid hydrating
// the private Primer Docs application under a different GitHub Pages pathname.
html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
html = rewriteRootRelativeUrls(html)

const styleTag = '<link rel="stylesheet" href="./pages-custom.css">'
const scriptTag = '<script src="./pages-client.js" defer></script>'

html = html.replace('</head>', styleTag + '\n</head>')
html = html.replace('</body>', scriptTag + '\n</body>')

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

const customNames = icons.filter(icon => icon.custom).map(icon => icon.name)
console.log('Mirrored original Octicons page')
console.log('Icons:', icons.length)
console.log('Custom icons:', customNames.length ? customNames.join(', ') : '(none)')
