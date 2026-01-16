const STORAGE_KEY = 'csmatrix.graph'
const METERS = [
  { key: 'grit', label: 'Grit', accent: '#f2d06b' },
  { key: 'collapse', label: 'Collapse', accent: '#ff6b9a' },
  { key: 'record', label: 'Record', accent: '#6ac7ff' },
  { key: 'influence', label: 'Influence', accent: '#63ffb1' },
]
const MAX_VALUE = 6
const DIE_TOGGLE_KEY = 'chud.die-toggle'

const clamp = (n) => Math.max(0, Math.min(MAX_VALUE, n))

function readGraphState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.warn('chud-meters: failed to read graph state', err)
    return null
  }
}

function readMeters() {
  const graph = readGraphState()
  const meta = graph?.meta?.globalMeters
  if (meta) {
    return {
      collapse: clamp(meta.collapse ?? 0),
      influence: clamp(meta.influence ?? 0),
      record: clamp(meta.record ?? 0),
      grit: clamp(meta.grit ?? 0),
    }
  }
  // fallback to sample values used by CS Matrix when empty
  return { collapse: 0, influence: 2, record: 1, grit: 0 }
}

function writeMeters(nextMeters) {
  try {
    const graph = readGraphState() || { nodes: [], edges: [], meta: {} }
    graph.meta = graph.meta || {}
    graph.meta.globalMeters = { ...(graph.meta.globalMeters || {}), ...nextMeters }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graph))
  } catch (err) {
    console.warn('chud-meters: failed to persist meters', err)
  }
}

function createStyles() {
  const style = document.createElement('style')
  style.textContent = `
    .chud-meters { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; background: linear-gradient(150deg, rgba(8,12,20,0.94), rgba(6,10,18,0.9)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 12px; box-shadow: 0 16px 32px rgba(0,0,0,0.45); }
    .chud-meters h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: 0.02em; color: #e9f0ff; }
    .chud-meter-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 12px; overflow: hidden; background: linear-gradient(120deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; }
    .chud-meter-row::after { content: ''; position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02); }
    .chud-meter-fill { position: absolute; inset: 0; width: 0%; background: var(--meter-accent, rgba(99,255,177,0.18)); opacity: 0.4; transition: width 180ms ease, opacity 120ms ease; }
    .chud-meter-label { position: relative; font-weight: 700; color: #f5fbff; }
    .chud-meter-value { position: relative; font-weight: 800; color: #f5fbff; font-size: 18px; letter-spacing: 0.08em; }
    .chud-meter-row:active .chud-meter-fill { opacity: 0.6; }

    .die-toggle { margin-top: 6px; padding: 10px 10px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(150deg, rgba(8,12,20,0.9), rgba(6,10,18,0.92)); box-shadow: 0 10px 24px rgba(0,0,0,0.45); display: flex; flex-direction: column; gap: 8px; }
    .die-toggle-header { display: flex; justify-content: space-between; align-items: center; color: #f5fbff; font-weight: 800; letter-spacing: 0.08em; font-size: 14px; text-transform: uppercase; }
    .die-track { position: relative; display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 8px; padding: 10px; border-radius: 12px; background: linear-gradient(120deg, #0f2338, #123a5c); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.35); cursor: pointer; overflow: hidden; }
    .die-track span { position: relative; z-index: 1; color: #e9f4ff; font-weight: 800; font-size: 28px; letter-spacing: 0.04em; text-align: center; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
    .die-thumb { position: absolute; top: 6px; bottom: 6px; width: calc(50% - 8px); background: linear-gradient(135deg, #ff7bd2, #ff4f6f); border: 2px solid rgba(0,0,0,0.35); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #0d0b0f; font-weight: 900; font-size: 30px; letter-spacing: 0.05em; box-shadow: 0 12px 26px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.28); transition: transform 180ms ease, box-shadow 180ms ease; z-index: 2; }
    .die-thumb.pos-atk { transform: translateX(0); }
    .die-thumb.pos-def { transform: translateX(calc(100% + 8px)); }
    .die-track:active .die-thumb { box-shadow: 0 12px 26px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.3); }
  `
  document.head.appendChild(style)
}

function buildMeterRow(def, getMeters, setMeters) {
  const row = document.createElement('div')
  row.className = 'chud-meter-row'
  row.dataset.meter = def.key
  row.style.setProperty('--meter-accent', def.accent)

  const fill = document.createElement('div')
  fill.className = 'chud-meter-fill'
  const label = document.createElement('span')
  label.className = 'chud-meter-label'
  label.textContent = def.label
  const value = document.createElement('span')
  value.className = 'chud-meter-value'

  row.appendChild(fill)
  row.appendChild(label)
  row.appendChild(value)

  const update = () => {
    const meters = getMeters()
    const v = clamp(meters[def.key] ?? 0)
    value.textContent = v
    fill.style.width = `${(v / MAX_VALUE) * 100}%`
  }

  const change = (delta) => {
    const meters = getMeters()
    const next = { ...meters, [def.key]: clamp((meters[def.key] ?? 0) + delta) }
    if (next[def.key] === meters[def.key]) return
    setMeters(next)
    update()
  }

  let timer = null
  let longPress = false
  const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null } }

  row.addEventListener('pointerdown', (ev) => {
    if (ev.button === 2) return
    longPress = false
    clearTimer()
    timer = setTimeout(() => { longPress = true; change(-1) }, 520)
  })
  row.addEventListener('pointerup', (ev) => {
    if (ev.button === 2) return
    if (timer) clearTimer()
    if (!longPress) change(+1)
    longPress = false
  })
  ;['pointerleave','pointercancel'].forEach((eventName) => {
    row.addEventListener(eventName, () => { clearTimer(); longPress = false })
  })
  row.addEventListener('contextmenu', (ev) => {
    ev.preventDefault()
    change(-1)
  })

  return { row, update }
}

function mountMeters() {
  const root = document.getElementById('root')
  if (!root) return false
  const heading = Array.from(document.querySelectorAll('h3')).find((h) => h.textContent?.trim().toLowerCase() === 'approach')
  if (!heading) return false
  const hostSection = heading.parentElement
  if (!hostSection || !hostSection.parentElement) return false
  if (hostSection.parentElement.querySelector('.chud-meters')) return true

  const wrapper = document.createElement('div')
  wrapper.className = 'chud-meters'
  const title = document.createElement('h3')
  title.textContent = 'Global Meters'
  wrapper.appendChild(title)

  const getMeters = () => readMeters()
  const setMeters = (next) => writeMeters(next)

  const rows = METERS.map((def) => buildMeterRow(def, getMeters, setMeters))
  rows.forEach((r) => { wrapper.appendChild(r.row) })

  // Die toggle UI below meters
  const dieToggle = buildDieToggle()
  wrapper.appendChild(dieToggle)

  const parent = hostSection.parentElement
  parent.insertBefore(wrapper, hostSection.nextSibling)

  const refreshAll = () => rows.forEach((r) => r.update())
  refreshAll()

  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY) refreshAll()
  })

  return true
}

function buildDieToggle() {
  const container = document.createElement('div')
  container.className = 'die-toggle'

  const header = document.createElement('div')
  header.className = 'die-toggle-header'
  header.innerHTML = '<span>ATK</span><span>DEF</span>'
  container.appendChild(header)

  const track = document.createElement('div')
  track.className = 'die-track'
  track.setAttribute('role', 'switch')
  track.setAttribute('tabindex', '0')

  const left = document.createElement('span')
  left.textContent = 'D8'
  const right = document.createElement('span')
  right.textContent = 'D8'

  const thumb = document.createElement('div')
  thumb.className = 'die-thumb'
  thumb.textContent = 'D10'

  const getState = () => {
    try {
      const raw = localStorage.getItem(DIE_TOGGLE_KEY)
      return raw === 'def' ? 'def' : 'atk'
    } catch {
      return 'atk'
    }
  }

  const setState = (next) => {
    const pos = next === 'def' ? 'def' : 'atk'
    track.dataset.state = pos
    track.setAttribute('aria-checked', pos === 'def' ? 'true' : 'false')
    thumb.classList.toggle('pos-def', pos === 'def')
    thumb.classList.toggle('pos-atk', pos !== 'def')
    try { localStorage.setItem(DIE_TOGGLE_KEY, pos) } catch {}
  }

  const toggle = () => {
    const next = track.dataset.state === 'def' ? 'atk' : 'def'
    setState(next)
  }

  track.addEventListener('click', toggle)
  track.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault()
      toggle()
    }
  })

  setState(getState())

  track.appendChild(left)
  track.appendChild(right)
  track.appendChild(thumb)
  container.appendChild(track)

  return container
}

function initMeters() {
  createStyles()
  const tryMount = () => {
    if (mountMeters()) return true
    return false
  }
  if (tryMount()) return
  const observer = new MutationObserver(() => { if (tryMount()) observer.disconnect() })
  observer.observe(document.body, { childList: true, subtree: true })
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    initMeters()
  } catch (err) {
    console.warn('chud-meters: init failed', err)
  }
})
