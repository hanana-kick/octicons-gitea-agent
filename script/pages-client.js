(() => {
  const manifestUrl = new URL('./octicons-manifest.json', window.location.href)
  const iconBaseUrl = new URL('./icons/', window.location.href)

  const normalize = value => String(value || '').trim().toLowerCase()

  function exactLeaf(text) {
    const expected = normalize(text)
    const elements = document.querySelectorAll('body *')
    for (const element of elements) {
      if (element.children.length === 0 && normalize(element.textContent) === expected) {
        return element
      }
    }
    return null
  }

  function controlFor(name) {
    const leaf = exactLeaf(name)
    if (!leaf) return null
    return (
      leaf.closest('button') ||
      leaf.closest('[role="button"]') ||
      leaf.closest('a') ||
      leaf.parentElement
    )
  }

  function replaceExactText(root, from, to) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    for (const node of nodes) {
      if (normalize(node.nodeValue) === normalize(from)) node.nodeValue = to
    }
  }

  function svgFor(name, size) {
    return fetch(new URL(name + '-' + size + '.svg', iconBaseUrl)).then(response => {
      if (!response.ok) throw new Error('Unable to load SVG')
      return response.text()
    })
  }

  async function replaceSvg(root, name, size) {
    const raw = await svgFor(name, size)
    const source = new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement
    let target = root.querySelector('svg')

    if (!target) {
      target = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      root.prepend(target)
    }

    for (const attr of [...target.attributes]) {
      if (!['class', 'style', 'aria-hidden', 'focusable'].includes(attr.name)) {
        target.removeAttribute(attr.name)
      }
    }

    target.setAttribute('viewBox', source.getAttribute('viewBox') || '0 0 ' + size + ' ' + size)
    target.setAttribute('width', String(size))
    target.setAttribute('height', String(size))
    target.setAttribute('fill', 'currentColor')
    target.innerHTML = source.innerHTML
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

    const size = icon.sizes.includes(16) ? 16 : icon.sizes[0]
    const raw = await svgFor(icon.name, size)

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
          const next = await svgFor(icon.name, candidate)
          preview.innerHTML = next
          const anchor = actions.querySelector('a')
          anchor.href = URL.createObjectURL(new Blob([next], {type: 'image/svg+xml'}))
          anchor.download = icon.name + '-' + candidate + '.svg'
        }),
      )
    }
    panel.append(sizes)

    const usageTitle = document.createElement('h3')
    usageTitle.textContent = 'Usage'
    panel.append(usageTitle)

    const code = document.createElement('pre')
    const component =
      icon.name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('') + 'Icon'
    code.textContent =
      "import {" +
      component +
      "} from '@primer/octicons-react'\n\n<" +
      component +
      ' size={' +
      size +
      '} />'
    panel.append(code)

    placeholder.replaceChildren(panel)
  }

  async function addCustomCards(manifest) {
    const customIcons = manifest.icons.filter(icon => icon.custom)
    if (!customIcons.length) return

    let reference =
      controlFor('stack-slash') ||
      controlFor('git-que-merge-agent') ||
      controlFor(manifest.icons.find(icon => !icon.custom)?.name)

    if (!reference || !reference.parentElement) return

    let insertAfter = reference
    for (const icon of customIcons) {
      const clone = reference.cloneNode(true)
      replaceExactText(clone, normalize(reference.textContent), icon.name)

      // Some cards include the icon name in nested labels rather than as the
      // control's full text, so replace the known reference label as well.
      const referenceName =
        manifest.icons.find(item => controlFor(item.name) === reference)?.name ||
        'stack-slash'
      replaceExactText(clone, referenceName, icon.name)

      clone.removeAttribute('href')
      clone.setAttribute('data-custom-octicon', icon.name)
      clone.addEventListener(
        'click',
        event => {
          event.preventDefault()
          event.stopPropagation()
          showCustomDetails(icon)
        },
        true,
      )

      const size = icon.sizes.includes(16) ? 16 : icon.sizes[0]
      replaceSvg(clone, icon.name, size).catch(() => {})

      insertAfter.insertAdjacentElement('afterend', clone)
      insertAfter = clone
    }
  }

  function bindExistingIcons(manifest) {
    for (const icon of manifest.icons) {
      if (icon.custom) continue
      const control = controlFor(icon.name)
      if (!control) continue

      control.addEventListener(
        'click',
        event => {
          event.preventDefault()
          const size = icon.sizes.includes(16) ? 16 : icon.sizes[0]
          window.location.href =
            'https://primer.style/octicons/icon/' +
            encodeURIComponent(icon.name + '-' + size) +
            '/'
        },
        true,
      )
    }
  }

  function bindSearch(manifest) {
    const input =
      document.querySelector('input[placeholder*="Search icons"]') ||
      document.querySelector('input[type="search"]')
    if (!input) return

    const entries = manifest.icons
      .map(icon => ({
        icon,
        control: controlFor(icon.name),
        haystack: normalize([icon.name, ...(icon.keywords || [])].join(' ')),
      }))
      .filter(entry => entry.control)

    const update = () => {
      const query = normalize(input.value)
      for (const entry of entries) {
        entry.control.hidden = Boolean(query) && !entry.haystack.includes(query)
      }
    }

    input.addEventListener('input', update)
    update()
  }

  function bindThemeToggle() {
    const candidates = [...document.querySelectorAll('button')]
    const toggle = candidates.find(button =>
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

    await addCustomCards(manifest)
    bindExistingIcons(manifest)
    bindSearch(manifest)
    bindThemeToggle()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true})
  } else {
    init()
  }
})()
