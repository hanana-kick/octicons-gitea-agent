import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const iconsDir = path.join(root, 'icons')
const outputDir = path.join(root, '_site')
const comparisonIcons = ['alert', 'code', 'copilot', 'issue-opened', 'repo', 'search']
const sizes = [16, 24]
const iconNames = [...comparisonIcons, 'gitea-agent']

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function comparisonCard(name, size) {
  const label = name.replaceAll('-', ' ')

  return `
        <article class="comparison-card">
          <h3>${escapeHtml(label)}</h3>
          <div class="icon-pair">
            <figure>
              <img src="./icons/${name}-${size}.svg" width="${size}" height="${size}" alt="${escapeHtml(label)} Octicon at ${size}px">
              <figcaption>Octicon</figcaption>
            </figure>
            <span class="versus" aria-hidden="true">vs</span>
            <figure>
              <img src="./icons/gitea-agent-${size}.svg" width="${size}" height="${size}" alt="Gitea Agent at ${size}px">
              <figcaption>Gitea Agent</figcaption>
            </figure>
          </div>
        </article>`
}

function sizeSection(size) {
  return `
      <section class="size-section" aria-labelledby="size-${size}">
        <div class="section-heading">
          <h2 id="size-${size}">${size}px icons</h2>
          <p>Rendered at their native ${size}px size</p>
        </div>
        <div class="comparison-grid">
          ${comparisonIcons.map(name => comparisonCard(name, size)).join('')}
        </div>
      </section>`
}

for (const name of iconNames) {
  for (const size of sizes) {
    const filename = `${name}-${size}.svg`
    const source = path.join(iconsDir, filename)
    if (!fs.existsSync(source)) {
      throw new Error(`Missing icon asset: ${filename}`)
    }
  }
}

fs.rmSync(outputDir, {recursive: true, force: true})
fs.mkdirSync(path.join(outputDir, 'icons'), {recursive: true})

for (const name of iconNames) {
  for (const size of sizes) {
    const filename = `${name}-${size}.svg`
    fs.copyFileSync(path.join(iconsDir, filename), path.join(outputDir, 'icons', filename))
  }
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f6f8fa">
    <title>Gitea Agent icon comparison</title>
    <link rel="stylesheet" href="./pages-custom.css">
  </head>
  <body>
    <main class="page">
      <header class="hero">
        <p class="eyebrow">OCTICONS × GITEA AGENT</p>
        <h1>Small icons.<br><span>Side by side.</span></h1>
        <p class="intro">See how Gitea Agent’s icon compares with a handful of familiar Octicons at their native sizes.</p>
      </header>
      ${sizes.map(sizeSection).join('')}
      <footer>All icons are shown at their actual pixel dimensions.</footer>
    </main>
  </body>
</html>
`

fs.writeFileSync(path.join(outputDir, 'index.html'), html)
fs.copyFileSync(path.join(root, 'script/pages-custom.css'), path.join(outputDir, 'pages-custom.css'))
fs.writeFileSync(path.join(outputDir, '.nojekyll'), '')
