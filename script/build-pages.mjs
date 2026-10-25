import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const iconsDir = path.join(root, 'icons')
const outputDir = path.join(root, '_site')
const outputIconsDir = path.join(outputDir, 'icons')

fs.rmSync(outputDir, {recursive: true, force: true})
fs.mkdirSync(outputDir, {recursive: true})
fs.cpSync(iconsDir, outputIconsDir, {recursive: true})

const keywords = JSON.parse(fs.readFileSync(path.join(root, 'keywords.json'), 'utf8'))
const iconPattern = /^(.*)-(\d+)\.svg$/
const groups = new Map()

for (const filename of fs.readdirSync(iconsDir).sort()) {
  const match = filename.match(iconPattern)
  if (!match) continue

  const [, name, sizeText] = match
  const size = Number(sizeText)
  const entry = groups.get(name) ?? {name, sizes: []}
  entry.sizes.push({size, filename})
  groups.set(name, entry)
}

const icons = [...groups.values()]
  .map(icon => ({
    ...icon,
    sizes: icon.sizes.sort((a, b) => a.size - b.size),
    keywords: keywords[icon.name] ?? [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const escapeHtml = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const cards = icons.map(icon => {
  const initial = icon.sizes.find(item => item.size === 16) ?? icon.sizes[0]
  const sizes = icon.sizes.map(item => item.size).join(',')
  const files = Object.fromEntries(icon.sizes.map(item => [item.size, item.filename]))
  const search = [icon.name, ...icon.keywords].join(' ').toLowerCase()

  return `<article class="icon-card" data-search="${escapeHtml(search)}" data-sizes="${sizes}" data-files='${escapeHtml(JSON.stringify(files))}'>
    <button class="preview" type="button" title="Copy SVG" aria-label="Copy ${escapeHtml(icon.name)} SVG">
      <img src="./icons/${escapeHtml(initial.filename)}" alt="" loading="lazy">
    </button>
    <div class="icon-name" title="${escapeHtml(icon.name)}">${escapeHtml(icon.name)}</div>
    <div class="icon-meta">${icon.sizes.map(item => `${item.size}px`).join(' · ')}</div>
  </article>`
}).join('\n')

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Octicons · Gitea Agent</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #ffffff;
      --fg: #1f2328;
      --muted: #59636e;
      --border: #d1d9e0;
      --card: #ffffff;
      --subtle: #f6f8fa;
      --accent: #0969da;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --fg: #f0f6fc;
        --muted: #9198a1;
        --border: #3d444d;
        --card: #0d1117;
        --subtle: #151b23;
        --accent: #4493f8;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 2;
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--bg) 92%, transparent);
      backdrop-filter: blur(12px);
    }
    .bar, main {
      width: min(1400px, calc(100% - 32px));
      margin: 0 auto;
    }
    .bar {
      display: grid;
      grid-template-columns: 1fr minmax(240px, 420px) auto;
      gap: 16px;
      align-items: center;
      min-height: 72px;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
    .subtitle {
      color: var(--muted);
      font-size: 12px;
      margin-top: 2px;
    }
    input, select {
      width: 100%;
      height: 36px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--fg);
      padding: 0 10px;
      font: inherit;
    }
    select { width: 84px; }
    main { padding: 24px 0 48px; }
    .summary {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(144px, 1fr));
      gap: 12px;
    }
    .icon-card {
      min-width: 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      background: var(--card);
    }
    .preview {
      width: 100%;
      height: 88px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 6px;
      background: var(--subtle);
      color: var(--fg);
      cursor: pointer;
    }
    .preview:hover { outline: 2px solid var(--accent); outline-offset: -2px; }
    .preview img {
      width: 32px;
      height: 32px;
      image-rendering: auto;
    }
    .icon-name {
      margin-top: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 600;
    }
    .icon-meta {
      margin-top: 3px;
      color: var(--muted);
      font-size: 11px;
    }
    .hidden { display: none; }
    .toast {
      position: fixed;
      right: 20px;
      bottom: 20px;
      padding: 9px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--fg);
      color: var(--bg);
      font-size: 12px;
      opacity: 0;
      transform: translateY(8px);
      pointer-events: none;
      transition: .15s ease;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    @media (max-width: 720px) {
      .bar {
        grid-template-columns: 1fr 78px;
        padding: 12px 0;
      }
      .title { grid-column: 1 / -1; }
      .grid { grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); }
    }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <div class="title">
        <h1>Octicons · Gitea Agent</h1>
        <div class="subtitle">Custom Octicons fork for Gitea Agent</div>
      </div>
      <input id="search" type="search" placeholder="Search icons…" autocomplete="off" aria-label="Search icons">
      <select id="size" aria-label="Preview size">
        <option value="16" selected>16px</option>
        <option value="24">24px</option>
      </select>
    </div>
  </header>
  <main>
    <div class="summary"><span id="count">${icons.length}</span> of ${icons.length} icons · Click an icon to copy its SVG</div>
    <section class="grid" id="grid">
      ${cards}
    </section>
  </main>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script>
    const cards = [...document.querySelectorAll('.icon-card')]
    const search = document.querySelector('#search')
    const size = document.querySelector('#size')
    const count = document.querySelector('#count')
    const toast = document.querySelector('#toast')
    let toastTimer

    function update() {
      const query = search.value.trim().toLowerCase()
      const preferredSize = Number(size.value)
      let visible = 0

      for (const card of cards) {
        const matches = !query || card.dataset.search.includes(query)
        card.classList.toggle('hidden', !matches)
        if (matches) visible += 1

        const files = JSON.parse(card.dataset.files)
        const sizes = card.dataset.sizes.split(',').map(Number)
        const selected = files[preferredSize] ?? files[sizes[0]]
        card.querySelector('img').src = './icons/' + selected
      }

      count.textContent = visible
    }

    function showToast(message) {
      toast.textContent = message
      toast.classList.add('show')
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => toast.classList.remove('show'), 1300)
    }

    for (const card of cards) {
      card.querySelector('.preview').addEventListener('click', async () => {
        const preferredSize = Number(size.value)
        const files = JSON.parse(card.dataset.files)
        const sizes = card.dataset.sizes.split(',').map(Number)
        const selected = files[preferredSize] ?? files[sizes[0]]
        const svg = await fetch('./icons/' + selected).then(response => response.text())
        await navigator.clipboard.writeText(svg)
        showToast('Copied ' + selected)
      })
    }

    search.addEventListener('input', update)
    size.addEventListener('change', update)
    update()
  </script>
</body>
</html>
`

fs.writeFileSync(path.join(outputDir, 'index.html'), html)
fs.writeFileSync(path.join(outputDir, '.nojekyll'), '')
console.log(`Generated ${icons.length} icons in ${outputDir}`)
