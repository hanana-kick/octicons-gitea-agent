(() => {
  const manifestUrl = new URL('./octicons-manifest.json', window.location.href)
  const iconBaseUrl = new URL('./icons/', window.location.href)

  const normalize = value => String(value || '').trim().toLowerCase()

  function exactLeaf(text) {
    const expected = normalize(text)
    for (const element of document.querySelectorAll('body *')) {
      if (element.children.length === 0 && normalize(element.textContent) === expected) {
        return element
      }
    }
    return null
  }

  function labelledControl(id) {
    if (!id) return null
    for (const element of document.querySelectorAll('[aria-labelledby]')) {
      if (element.getAttribute('aria-labelledby') === id) return element
    }
    return null
  }

  function labelForControl(control) {
    if (!control) return null
    const id = control.getAttribute('aria-labelledby')
    return id ? document.getElementById(id) : null
  }

  function controlFor(name) {
    for (const element of document.querySelectorAll('[data-custom-octicon]')) {
      if (element.getAttribute('data-custom-octicon') === name) return element
    }

    const leaf = exactLeaf(name)
    if (!leaf) return null

    return (
      labelledControl(leaf.id) ||
      leaf.closest('button') ||
      leaf.closest('[role="button"]') ||
      leaf.closest('a') ||
      null
    )
  }

  function svgFor(name, size) {
    return fetch(new URL(name + '-' + size + '.svg', iconBaseUrl)).then(response => {
      if (!response.ok) throw new Error('Unable to load SVG')
      return response.text()
    })
  }

  function findDetailsPlaceholder() {
    const leaf = exactLeaf('Select an icon to view sizing and usage details.')
    if (!leaf) return null
    return leaf.parentElement || leaf
  }

  function button(label, onClick) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'custom-octicon-button'
    el.textContent = label
    el.addEventListener('click', onClick)
    return el
  }

  async function showCustomDetails(icon) {
    const placeholder = findDetailsPlaceholder()
    if (!placeholder) return

    let size = icon.sizes.includes(16) ? 16 : icon.sizes[0]
    let raw = await svgFor(icon.name, size)

    const panel = document.createElement('div')
    panel.className = 'custom-octicon-details'

    const title = document.createElement('h2')
    title.textContent = icon.name
    panel.append(title)

    const preview = document.createElement('div')
    preview.className = 'custom-octicon-preview'
    preview.innerHTML = raw
    panel.append(preview)

    const actions = document.createElement('div')
    actions.className = 'custom-octicon-actions'

    actions.append(
      button('Copy SVG', async () => {
        await navigator.clipboard.writeText(raw)
      }),
    )

    const download = document.createElement('a')
    download.className = 'custom-octicon-button'
    download.textContent = 'Download SVG'
    download.href = URL.createObjectURL(new Blob([raw], {type: 'image/svg+xml'}))
    download.download = icon.name + '-' + size + '.svg'
    actions.append(download)
    panel.append(actions)

    const sizesTitle = document.createElement('h3')
    sizesTitle.textContent = 'Sizes'
    panel.append(sizesTitle)

    const sizes = document.createElement('div')
    sizes.className = 'custom-octicon-size-list'

    for (const candidate of icon.sizes) {
      sizes.append(
        button(candidate + 'px', async () => {
          size = candidate
          raw = await svgFor(icon.name, candidate)
          preview.innerHTML = raw
          download.href = URL.createObjectURL(new Blob([raw], {type: 'image/svg+xml'}))
          download.download = icon.name + '-' + candidate + '.svg'
        }),
      )
    }

    panel.append(sizes)

    const sourceTitle = document.createElement('h3')
    sourceTitle.textContent = 'Source'
    panel.append(sourceTitle)

    const code = document.createElement('pre')
    code.textContent = 'icons/' + icon.name + '-' + size + '.svg'
    panel.append(code)

    placeholder.replaceChildren(panel)
  }

  function bindCustomIcons(manifest) {
    for (const icon of manifest.icons.filter(item => item.custom)) {
      const control = controlFor(icon.name)
      if (!control) continue

      control.addEventListener('click', event => {
        event.preventDefault()
        showCustomDetails(icon)
      })
    }
  }

  function bindSearch(manifest) {
    const input =
      document.querySelector('input[placeholder*="Search icons"]') ||
      document.querySelector('input[type="search"]')
    if (!input) return

    const entries = manifest.icons
      .map(icon => {
        const control = controlFor(icon.name)
        return {
          control,
          label: labelForControl(control),
          haystack: normalize([icon.name, ...(icon.keywords || [])].join(' ')),
        }
      })
      .filter(entry => entry.control)

    const update = () => {
      const query = normalize(input.value)

      for (const entry of entries) {
        const hidden = Boolean(query) && !entry.haystack.includes(query)
        entry.control.hidden = hidden
        if (entry.label) entry.label.hidden = hidden
      }
    }

    input.addEventListener('input', update)
    update()
  }

  function bindThemeToggle() {
    const toggle = [...document.querySelectorAll('button')].find(button =>
      /switch to (dark|light) mode/i.test(button.textContent || ''),
    )
    if (!toggle) return

    toggle.addEventListener('click', event => {
      event.preventDefault()
      const html = document.documentElement
      const current = html.getAttribute('data-color-mode') || 'light'
      const next = current === 'dark' ? 'light' : 'dark'
      html.setAttribute('data-color-mode', next)
      toggle.textContent = next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    })
  }

  async function init() {
    const response = await fetch(manifestUrl)
    if (!response.ok) return

    const manifest = await response.json()

    bindCustomIcons(manifest)
    bindSearch(manifest)
    bindThemeToggle()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true})
  } else {
    init()
  }
})()
