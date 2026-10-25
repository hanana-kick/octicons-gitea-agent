(() => {
  const manifestUrl = new URL(
    './octicons-manifest.json',
    window.location.href,
  )
  const iconBaseUrl = new URL('./icons/', window.location.href)
  const normalize = value =>
    String(value || '').trim().toLowerCase()

  function labelForControl(control) {
    const id = control?.getAttribute('aria-labelledby')
    return id ? document.getElementById(id) : null
  }

  function iconControls() {
    return [...document.querySelectorAll('a[data-octicon]')]
  }

  function svgFor(name, size) {
    return fetch(
      new URL(name + '-' + size + '.svg', iconBaseUrl),
    ).then(response => {
      if (!response.ok) {
        throw new Error('Unable to load SVG: ' + name + '-' + size)
      }
      return response.text()
    })
  }

  function detailsContainer() {
    return document.getElementById('octicons-detail-panel')
  }

  function button(label, onClick) {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'custom-octicon-button'
    element.textContent = label
    element.addEventListener('click', onClick)
    return element
  }

  async function showDetails(icon) {
    const container = detailsContainer()
    if (!container) {
      throw new Error('Icon detail panel not found')
    }

    const loading = document.createElement('p')
    loading.textContent = 'Loading ' + icon.name + '…'
    container.replaceChildren(loading)

    let size = icon.sizes.includes(16)
      ? 16
      : icon.sizes[0]

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
    download.href = URL.createObjectURL(
      new Blob([raw], {type: 'image/svg+xml'}),
    )
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
          download.href = URL.createObjectURL(
            new Blob([raw], {type: 'image/svg+xml'}),
          )
          download.download =
            icon.name + '-' + candidate + '.svg'
        }),
      )
    }

    panel.append(sizes)

    const sourceTitle = document.createElement('h3')
    sourceTitle.textContent = 'Source'
    panel.append(sourceTitle)

    const code = document.createElement('pre')
    code.textContent =
      'icons/' + icon.name + '-' + size + '.svg'
    panel.append(code)

    container.replaceChildren(panel)
  }

  function bindCards(manifest) {
    const byName = new Map(
      manifest.icons.map(icon => [icon.name, icon]),
    )

    document.addEventListener('click', event => {
      const control = event.target?.closest?.('a[data-octicon]')
      if (!control) return

      const name = control.dataset.octicon
      const icon = byName.get(name)
      if (!icon) return

      event.preventDefault()
      history.replaceState(null, '', '#' + name)

      showDetails(icon).catch(error => {
        const container = detailsContainer()
        if (container) {
          const message = document.createElement('p')
          message.textContent = 'Unable to load ' + name + '.'
          container.replaceChildren(message)
        }
        console.error('[octicons-gitea-agent]', error)
      })
    })

    const initialName = decodeURIComponent(
      window.location.hash.replace(/^#/, ''),
    )
    const initialIcon = byName.get(initialName)

    if (initialIcon) {
      showDetails(initialIcon).catch(error => {
        console.error('[octicons-gitea-agent]', error)
      })
    }
  }

  function bindSearch(manifest) {
    const input =
      document.querySelector('#search-input') ||
      document.querySelector('input[aria-label="Search icons"]')

    if (!input) {
      throw new Error('Search input not found')
    }

    const byName = new Map(
      manifest.icons.map(icon => [icon.name, icon]),
    )

    const entries = iconControls()
      .map(control => {
        const name = control.dataset.octicon
        const icon = byName.get(name)
        const label = labelForControl(control)

        return {
          control,
          label,
          haystack: normalize(
            [name, ...(icon?.keywords ?? [])].join(' '),
          ),
        }
      })

    const update = () => {
      const query = normalize(input.value)

      for (const entry of entries) {
        const visible =
          !query || entry.haystack.includes(query)

        entry.control.style.display = visible ? '' : 'none'
        if (entry.label) {
          entry.label.style.display = visible ? '' : 'none'
        }
      }
    }

    input.addEventListener('input', update)
    input.addEventListener('search', update)
    update()
  }

  function bindOcticonsHomeLink() {
    for (const link of document.querySelectorAll('a[href="./"]')) {
      if (normalize(link.textContent) === 'octicons') {
        link.addEventListener('click', event => {
          event.preventDefault()
          history.replaceState(null, '', './')
          window.scrollTo({top: 0, behavior: 'smooth'})
        })
      }
    }
  }

  async function init() {
    const response = await fetch(manifestUrl)
    if (!response.ok) {
      throw new Error('Unable to load Octicons manifest')
    }

    const manifest = await response.json()

    bindCards(manifest)
    bindSearch(manifest)
    bindOcticonsHomeLink()
  }

  const start = () => {
    init().catch(error => {
      console.error('[octicons-gitea-agent]', error)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {
      once: true,
    })
  } else {
    start()
  }
})()
