const STORAGE_KEY = 'csmatrix.graph'
const WALLET_KEY = 'chud.wallet'
const COMBAT_KEY = 'chud.combat'
const METERS = [
  { key: 'record', label: 'Record', accent: '#6ac7ff' },
  { key: 'influence', label: 'Influence', accent: '#63ffb1' },
]
const MAX_VALUE = 6

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
    .chud-meters { margin-top: 4px; }
    .chud-meters-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); padding: 6px 0 8px; cursor: pointer; color: rgba(248,250,252,0.65); font-size: 13px; font-family: inherit; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
    .chud-meters.open .chud-meters-toggle { color: rgba(248,250,252,0.9); border-bottom-color: rgba(255,255,255,0.18); }
    .chud-meters-chevron { font-size: 9px; opacity: 0.7; }
    .chud-meters-body { display: none; padding: 8px 0 0; display: none; flex-direction: column; gap: 10px; }
    .chud-meters.open .chud-meters-body { display: flex; }
    .chud-wallet { margin-top: 4px; }
    .chud-wallet-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); padding: 6px 0 8px; cursor: pointer; color: rgba(248,250,252,0.65); font-size: 13px; font-family: inherit; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
    .chud-wallet.open .chud-wallet-toggle { color: rgba(248,250,252,0.9); border-bottom-color: rgba(255,255,255,0.18); }
    .chud-wallet-chevron { font-size: 9px; opacity: 0.7; }
    .chud-wallet-body { display: none; padding: 8px 0 0; flex-direction: column; gap: 10px; }
    .chud-wallet.open .chud-wallet-body { display: flex; }
    .chud-meter-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 12px; overflow: hidden; background: linear-gradient(120deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; }
    .chud-meter-row::after { content: ''; position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02); }
    .chud-meter-fill { position: absolute; inset: 0; width: 0%; background: var(--meter-accent, rgba(99,255,177,0.18)); opacity: 0.4; transition: width 180ms ease, opacity 120ms ease; }
    .chud-meter-label { position: relative; font-weight: 700; color: #f5fbff; }
    .chud-meter-value { position: relative; font-weight: 800; color: #f5fbff; font-size: 18px; letter-spacing: 0.08em; }
    .chud-meter-row:active .chud-meter-fill { opacity: 0.6; }

    /* ── Grit / Collapse combined meter ─────────────────────────────── */
    .gcm { border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(120deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); }
    .gcm-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px 6px; }
    .gcm-label { display: flex; align-items: center; gap: 6px; }
    .gcm-name { font-weight: 700; font-size: 13px; color: #f5fbff; letter-spacing: 0.04em; }
    .gcm-val { font-weight: 800; font-size: 18px; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; }
    .gcm-val-grit { color: #f2d06b; }
    .gcm-val-collapse { color: #ff6b9a; }
    .gcm-track { position: relative; height: 28px; margin: 0 12px 12px; border-radius: 8px; background: rgba(6,10,18,0.7); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06); cursor: pointer; }
    .gcm-fill-grit { position: absolute; top: 0; left: 0; height: 100%; background: linear-gradient(90deg, #a07a10, #f2d06b); border-radius: 8px 0 0 8px; transition: width 180ms ease, opacity 180ms ease, box-shadow 300ms ease; box-shadow: 2px 0 12px rgba(242,208,107,0.3); }
    .gcm-fill-collapse { position: absolute; top: 0; right: 0; height: 100%; background: linear-gradient(270deg, #9b1b4a, #ff6b9a); border-radius: 0 8px 8px 0; transition: width 180ms ease, box-shadow 300ms ease; box-shadow: -2px 0 12px rgba(255,107,154,0.3); }
    .gcm-tap { position: absolute; top: 0; height: 100%; width: 50%; z-index: 1; cursor: pointer; }
    .gcm-tap-left { left: 0; }
    .gcm-tap-right { right: 0; }
    .gcm[data-grit-severity="low"] .gcm-fill-grit { opacity: 0.6; box-shadow: 2px 0 8px rgba(242,208,107,0.15); }
    .gcm[data-grit-severity="zero"] .gcm-fill-grit { opacity: 0.25; }
    .gcm[data-grit-severity="zero"] .gcm-val-grit { animation: gcm-grit-warn 2s ease-in-out infinite; }
    @keyframes gcm-grit-warn { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
    .gcm[data-collapse-severity="elevated"] .gcm-fill-collapse { box-shadow: -2px 0 16px rgba(255,107,154,0.45); }
    /* high (5): whole widget border alarm, brighter fill, pulsing value */
    .gcm[data-collapse-severity="high"] { border-color: rgba(255,61,122,0.6); animation: gcm-border-alarm 1.2s ease-in-out infinite; }
    .gcm[data-collapse-severity="high"] .gcm-fill-collapse { background: linear-gradient(270deg, #b91c4a, #ff3d7a); box-shadow: -2px 0 28px rgba(255,61,122,0.8); animation: gcm-pulse 1.1s ease-in-out infinite; }
    .gcm[data-collapse-severity="high"] .gcm-val-collapse { color: #ff3d7a; animation: gcm-pulse 1.1s ease-in-out infinite; }
    /* critical (6): full terror — trembling widget, blazing outer glow, rapid flicker */
    .gcm[data-collapse-severity="critical"] { border-color: rgba(220,15,55,0.92); box-shadow: 0 0 22px rgba(220,15,55,0.45), 0 0 55px rgba(140,0,30,0.28); animation: gcm-crt-stutter 3s steps(1, end) infinite; }
    .gcm[data-collapse-severity="critical"] .gcm-fill-collapse { background: linear-gradient(270deg, #3a0012, #ff1040); box-shadow: -2px 0 42px rgba(255,10,50,1); animation: gcm-flicker 0.65s ease-in-out infinite; }
    .gcm[data-collapse-severity="critical"] .gcm-val-collapse { color: #ff1040; font-size: 22px; animation: gcm-flicker 0.65s ease-in-out infinite; }
    .gcm[data-collapse-severity="critical"] .gcm-name-collapse { animation: gcm-flicker 1.1s ease-in-out infinite; }
    @keyframes gcm-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes gcm-flicker { 0%,100% { opacity:1; } 28% { opacity:0.7; } 52% { opacity:0.12; } 74% { opacity:0.88; } }
    @keyframes gcm-border-alarm { 0%,100% { box-shadow: 0 0 14px rgba(255,61,122,0.18); } 50% { box-shadow: 0 0 28px rgba(255,61,122,0.48), 0 0 48px rgba(180,0,60,0.22); } }
    @keyframes gcm-crt-stutter {
      0%   { transform: translate(0,0); filter: none; opacity: 1; }
      4%   { transform: translate(-6px, 0); filter: brightness(1.6) hue-rotate(10deg); opacity: 1; }
      5%   { transform: translate(4px, 0); filter: brightness(0.4); opacity: 1; }
      6%   { transform: translate(0, 0); filter: none; opacity: 1; }
      18%  { transform: translate(0, 0); filter: none; opacity: 1; }
      19%  { transform: translate(0, -4px); filter: brightness(0); opacity: 0; }
      20%  { transform: translate(0, 0); filter: none; opacity: 1; }
      35%  { transform: translate(0, 0); filter: none; opacity: 1; }
      36%  { transform: translate(8px, 0); filter: brightness(2) saturate(3); opacity: 1; }
      37%  { transform: translate(0, 0); filter: brightness(0.2); opacity: 1; }
      38%  { transform: translate(-4px, 0); filter: none; opacity: 1; }
      39%  { transform: translate(0, 0); filter: none; opacity: 1; }
      55%  { transform: translate(0, 0); filter: none; opacity: 1; }
      56%  { transform: translate(0, 0); filter: brightness(0); opacity: 0; }
      57%  { transform: translate(0, 0); filter: brightness(0); opacity: 0; }
      58%  { transform: translate(0, 0); filter: none; opacity: 1; }
      72%  { transform: translate(0, 0); filter: none; opacity: 1; }
      73%  { transform: translate(-10px, 0); filter: brightness(1.8) hue-rotate(-15deg); opacity: 1; }
      74%  { transform: translate(6px, 0); filter: brightness(0.3); opacity: 1; }
      75%  { transform: translate(0, 0); filter: none; opacity: 1; }
      88%  { transform: translate(0, 0); filter: none; opacity: 1; }
      89%  { transform: translate(0, 3px); filter: brightness(0); opacity: 0; }
      90%  { transform: translate(0, 0); filter: none; opacity: 1; }
      100% { transform: translate(0,0); filter: none; opacity: 1; }
    }

    /* ── Wallet ────────────────────────────────────────────────────── */
    .chud-wallet-balance { font-size: 26px; font-weight: 800; letter-spacing: 0.06em; color: #3de8c0; font-variant-numeric: tabular-nums; }
    .chud-wallet-balance-unit { font-size: 14px; font-weight: 600; color: rgba(61,232,192,0.55); margin-left: 4px; letter-spacing: 0.1em; }
    .chud-wallet-controls { display: flex; gap: 8px; align-items: center; }
    .chud-wallet-input { flex: 1; min-width: 0; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 12px; font-size: 22px; font-weight: 700; color: #e9f0ff; text-align: center; outline: none; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
    .chud-wallet-input::-webkit-outer-spin-button, .chud-wallet-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .chud-wallet-input:focus { border-color: rgba(61,232,192,0.4); box-shadow: 0 0 0 2px rgba(61,232,192,0.1); }
    .chud-wallet-btn { flex-shrink: 0; width: 52px; height: 52px; border: none; border-radius: 10px; font-size: 28px; font-weight: 700; cursor: pointer; transition: opacity 120ms, transform 80ms; display: flex; align-items: center; justify-content: center; }
    .chud-wallet-btn:active { transform: scale(0.95); opacity: 0.85; }
    .chud-wallet-btn.debit  { background: linear-gradient(135deg, #0fa878, #3de8c0); color: #051a14; }
    .chud-wallet-btn.credit { background: linear-gradient(135deg, #9b1b4a, #ff6b9a); color: #fff; }

    /* ── Combat Panel ──────────────────────────────────────────────── */
    .chud-combat { margin-top: 4px; }
    .chud-combat-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); padding: 6px 0 8px; cursor: pointer; color: rgba(248,250,252,0.65); font-size: 13px; font-family: inherit; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
    .chud-combat.open .chud-combat-toggle { color: rgba(248,250,252,0.9); border-bottom-color: rgba(255,255,255,0.18); }
    .chud-combat-chevron { font-size: 9px; opacity: 0.7; }
    .chud-combat-body { display: none; padding: 8px 0 0; }
    .chud-combat-body.open { display: flex; gap: 12px; align-items: stretch; }
    .combat-rt { flex: 1; cursor: pointer; user-select: none; -webkit-user-select: none; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); }
    .combat-rt-header { display: flex; align-items: center; gap: 8px; }
    .combat-rt-label { font-weight: 700; font-size: 11px; color: #94a3b8; letter-spacing: 0.06em; text-transform: uppercase; }
    .combat-rt-val { font-weight: 800; font-size: 20px; color: #f5fbff; letter-spacing: 0.06em; font-variant-numeric: tabular-nums; }
    .combat-rt-pips { display: flex; gap: 4px; }
    .combat-rt-pip { flex: 1; height: 8px; border-radius: 3px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); transition: background 140ms, box-shadow 140ms; }
    .combat-rt-pip.active { background: linear-gradient(90deg, #4ade80, #86efac); box-shadow: 0 0 6px rgba(74,222,128,0.4); border-color: transparent; }
    .combat-chip-wrap { flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; }
    .combat-chip-toggle { height: 100%; padding: 10px 14px; border: 1px solid rgba(74,222,128,0.4); border-radius: 10px; background: rgba(74,222,128,0.08); color: #4ade80; font-weight: 700; font-size: 11px; letter-spacing: 0.08em; cursor: pointer; transition: background 120ms, border-color 120ms, color 120ms, transform 80ms; text-align: center; white-space: nowrap; line-height: 1.4; }
    .combat-chip-toggle:active { transform: scale(0.97); }
    .combat-chip-toggle[data-desynced="1"] { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.5); color: #f87171; }
  `
  document.head.appendChild(style)
}

function readWallet() {
  try {
    const raw = localStorage.getItem(WALLET_KEY)
    return raw !== null ? parseInt(raw, 10) || 0 : 0
  } catch { return 0 }
}

function writeWallet(balance) {
  try { localStorage.setItem(WALLET_KEY, String(balance)) } catch {}
}

function buildWalletWidget() {
  let open = false
  const container = document.createElement('div')
  container.className = 'chud-wallet'

  const toggleBtn = document.createElement('button')
  toggleBtn.className = 'chud-wallet-toggle'
  toggleBtn.setAttribute('data-touch-blocker-ignore', '')
  const toggleLabel = document.createElement('span')
  toggleLabel.textContent = 'Wallet'
  const chevron = document.createElement('span')
  chevron.className = 'chud-wallet-chevron'
  chevron.textContent = '\u25bc'
  toggleBtn.appendChild(toggleLabel)
  toggleBtn.appendChild(chevron)
  container.appendChild(toggleBtn)

  toggleBtn.addEventListener('click', () => {
    open = !open
    container.className = 'chud-wallet' + (open ? ' open' : '')
    chevron.className = 'chud-wallet-chevron' + (open ? ' open' : '')
  })

  const body = document.createElement('div')
  body.className = 'chud-wallet-body'

  const header = document.createElement('div')
  header.className = 'chud-wallet-header'
  const balanceWrap = document.createElement('div')
  const balanceEl = document.createElement('span')
  balanceEl.className = 'chud-wallet-balance'
  const unitEl = document.createElement('span')
  unitEl.className = 'chud-wallet-balance-unit'
  unitEl.textContent = 'CC'
  balanceWrap.appendChild(balanceEl)
  balanceWrap.appendChild(unitEl)
  header.appendChild(balanceWrap)
  body.appendChild(header)

  const controls = document.createElement('div')
  controls.className = 'chud-wallet-controls'
  const input = document.createElement('input')
  input.type = 'number'
  input.className = 'chud-wallet-input'
  input.placeholder = '0'
  input.min = '0'
  input.setAttribute('inputmode', 'numeric')
  input.setAttribute('autocomplete', 'off')
  input.setAttribute('data-touch-blocker-ignore', '')
  const debitBtn = document.createElement('button')
  debitBtn.className = 'chud-wallet-btn debit'
  debitBtn.textContent = '+'
  debitBtn.setAttribute('data-touch-blocker-ignore', '')
  const creditBtn = document.createElement('button')
  creditBtn.className = 'chud-wallet-btn credit'
  creditBtn.textContent = '−'
  creditBtn.setAttribute('data-touch-blocker-ignore', '')
  controls.appendChild(input)
  controls.appendChild(debitBtn)
  controls.appendChild(creditBtn)
  body.appendChild(controls)
  container.appendChild(body)

  const refresh = () => { balanceEl.textContent = readWallet() }
  refresh()

  const getAmount = () => { const v = parseInt(input.value, 10); return (isNaN(v) || v < 0) ? 0 : v }
  debitBtn.addEventListener('click', () => {
    const amt = getAmount(); if (!amt) return
    writeWallet(readWallet() + amt)
    input.value = ''; refresh()
  })
  creditBtn.addEventListener('click', () => {
    const amt = getAmount(); if (!amt) return
    writeWallet(Math.max(0, readWallet() - amt))
    input.value = ''; refresh()
  })
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') debitBtn.click() })

  window.addEventListener('storage', (ev) => { if (ev.key === WALLET_KEY) refresh() })

  return container
}

function buildGritCollapseMeter(getMeters, setMeters) {
  const container = document.createElement('div')
  container.className = 'gcm'

  const header = document.createElement('div')
  header.className = 'gcm-header'

  const leftLabel = document.createElement('div')
  leftLabel.className = 'gcm-label'
  const gritName = document.createElement('span')
  gritName.className = 'gcm-name'
  gritName.textContent = 'Grit'
  const gritVal = document.createElement('span')
  gritVal.className = 'gcm-val gcm-val-grit'
  leftLabel.appendChild(gritName)
  leftLabel.appendChild(gritVal)

  const rightLabel = document.createElement('div')
  rightLabel.className = 'gcm-label'
  const collapseVal = document.createElement('span')
  collapseVal.className = 'gcm-val gcm-val-collapse'
  const collapseName = document.createElement('span')
  collapseName.className = 'gcm-name gcm-name-collapse'
  collapseName.textContent = 'Collapse'
  rightLabel.appendChild(collapseVal)
  rightLabel.appendChild(collapseName)

  header.appendChild(leftLabel)
  header.appendChild(rightLabel)
  container.appendChild(header)

  const track = document.createElement('div')
  track.className = 'gcm-track'
  const gritFill = document.createElement('div')
  gritFill.className = 'gcm-fill-grit'
  const collapseFill = document.createElement('div')
  collapseFill.className = 'gcm-fill-collapse'
  const tapLeft = document.createElement('div')
  tapLeft.className = 'gcm-tap gcm-tap-left'
  const tapRight = document.createElement('div')
  tapRight.className = 'gcm-tap gcm-tap-right'
  track.appendChild(gritFill)
  track.appendChild(collapseFill)
  track.appendChild(tapLeft)
  track.appendChild(tapRight)
  container.appendChild(track)

  const update = () => {
    const meters = getMeters()
    const collapse = clamp(meters.collapse ?? 0)
    const maxGrit = Math.max(0, MAX_VALUE - collapse)
    const grit = Math.min(clamp(meters.grit ?? 0), maxGrit)
    gritFill.style.width = `${(grit / MAX_VALUE) * 100}%`
    collapseFill.style.width = `${(collapse / MAX_VALUE) * 100}%`
    gritVal.textContent = grit
    collapseVal.textContent = collapse
    container.dataset.gritSeverity = grit === 0 ? 'zero' : grit === 1 ? 'low' : 'ok'
    container.dataset.collapseSeverity = collapse >= 6 ? 'critical' : collapse >= 5 ? 'high' : collapse >= 4 ? 'elevated' : 'ok'
  }

  const makeTapHandler = (isLeft) => {
    const el = isLeft ? tapLeft : tapRight
    let timer = null
    let longPress = false
    const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null } }
    const change = (delta) => {
      const meters = getMeters()
      const collapse = clamp(meters.collapse ?? 0)
      const maxGrit = Math.max(0, MAX_VALUE - collapse)
      if (isLeft) {
        const next = Math.min(maxGrit, Math.max(0, (meters.grit ?? 0) + delta))
        if (next === clamp(meters.grit ?? 0)) return
        setMeters({ ...meters, grit: next })
      } else {
        const next = clamp((meters.collapse ?? 0) + delta)
        if (next === collapse) return
        const trimmedGrit = Math.min(meters.grit ?? 0, Math.max(0, MAX_VALUE - next))
        setMeters({ ...meters, collapse: next, grit: trimmedGrit })
      }
      update()
    }
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button === 2) return
      longPress = false; clearTimer()
      timer = setTimeout(() => { longPress = true; change(-1) }, 520)
    })
    el.addEventListener('pointerup', (ev) => {
      if (ev.button === 2) return
      clearTimer()
      if (!longPress) change(+1)
      longPress = false
    })
    ;['pointerleave', 'pointercancel'].forEach((evt) => {
      el.addEventListener(evt, () => { clearTimer(); longPress = false })
    })
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault(); clearTimer(); longPress = false; change(-1)
    })
  }

  makeTapHandler(true)
  makeTapHandler(false)
  update()

  return { container, update }
}

function readCombat() {
  try {
    const raw = localStorage.getItem(COMBAT_KEY)
    if (!raw) return { reactionTokens: 0, chipDesynced: false }
    return { reactionTokens: 0, chipDesynced: false, ...JSON.parse(raw) }
  } catch { return { reactionTokens: 0, chipDesynced: false } }
}

function writeCombat(state) {
  try { localStorage.setItem(COMBAT_KEY, JSON.stringify(state)) } catch {}
}

function buildCombatPanel() {
  let open = false
  const container = document.createElement('div')
  container.className = 'chud-combat'

  const toggleBtn = document.createElement('button')
  toggleBtn.className = 'chud-combat-toggle'
  toggleBtn.setAttribute('data-touch-blocker-ignore', '')
  const toggleLabel = document.createElement('span')
  toggleLabel.textContent = 'Combat'
  const chevron = document.createElement('span')
  chevron.className = 'chud-combat-chevron'
  chevron.textContent = '\u25bc'
  toggleBtn.appendChild(toggleLabel)
  toggleBtn.appendChild(chevron)
  container.appendChild(toggleBtn)

  const body = document.createElement('div')
  body.className = 'chud-combat-body'

  const rtSection = document.createElement('div')
  rtSection.className = 'combat-rt'
  rtSection.setAttribute('data-touch-blocker-ignore', '')

  const rtHeader = document.createElement('div')
  rtHeader.className = 'combat-rt-header'
  const rtLabel = document.createElement('span')
  rtLabel.className = 'combat-rt-label'
  rtLabel.textContent = 'Reaction Tokens'
  const rtVal = document.createElement('span')
  rtVal.className = 'combat-rt-val'
  rtHeader.appendChild(rtLabel)
  rtHeader.appendChild(rtVal)

  const rtPips = document.createElement('div')
  rtPips.className = 'combat-rt-pips'

  rtSection.appendChild(rtHeader)
  rtSection.appendChild(rtPips)
  body.appendChild(rtSection)

  const chipWrap = document.createElement('div')
  chipWrap.className = 'combat-chip-wrap'
  const chipBtn = document.createElement('button')
  chipBtn.className = 'combat-chip-toggle'
  chipBtn.setAttribute('data-touch-blocker-ignore', '')
  chipWrap.appendChild(chipBtn)
  body.appendChild(chipWrap)

  container.appendChild(body)

  const refresh = () => {
    const state = readCombat()
    const tokens = Math.max(0, Math.min(6, state.reactionTokens ?? 0))
    rtVal.textContent = tokens
    rtPips.innerHTML = ''
    for (let i = 0; i < 6; i++) {
      const pip = document.createElement('span')
      pip.className = 'combat-rt-pip' + (i < tokens ? ' active' : '')
      rtPips.appendChild(pip)
    }
    const desynced = !!state.chipDesynced
    chipBtn.textContent = desynced ? 'Chip Desynced' : 'Chip Synced'
    chipBtn.dataset.desynced = desynced ? '1' : '0'
  }

  toggleBtn.addEventListener('click', () => {
    open = !open
    container.className = 'chud-combat' + (open ? ' open' : '')
    body.className = 'chud-combat-body' + (open ? ' open' : '')
    chevron.className = 'chud-combat-chevron' + (open ? ' open' : '')
  })

  let timer = null, longPress = false
  const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null } }
  rtSection.addEventListener('pointerdown', (ev) => {
    if (ev.button === 2) return
    longPress = false; clearTimer()
    timer = setTimeout(() => {
      longPress = true
      const s = readCombat(); writeCombat({ ...s, reactionTokens: Math.max(0, (s.reactionTokens ?? 0) - 1) }); refresh()
    }, 520)
  })
  rtSection.addEventListener('pointerup', (ev) => {
    if (ev.button === 2) return
    clearTimer()
    if (!longPress) { const s = readCombat(); writeCombat({ ...s, reactionTokens: Math.min(6, (s.reactionTokens ?? 0) + 1) }); refresh() }
    longPress = false
  })
  ;['pointerleave', 'pointercancel'].forEach((evt) => {
    rtSection.addEventListener(evt, () => { clearTimer(); longPress = false })
  })
  rtSection.addEventListener('contextmenu', (ev) => {
    ev.preventDefault(); clearTimer(); longPress = false
    const s = readCombat(); writeCombat({ ...s, reactionTokens: Math.max(0, (s.reactionTokens ?? 0) - 1) }); refresh()
  })

  chipBtn.addEventListener('click', () => {
    const s = readCombat(); writeCombat({ ...s, chipDesynced: !s.chipDesynced }); refresh()
  })

  refresh()
  window.addEventListener('storage', (ev) => { if (ev.key === COMBAT_KEY) refresh() })
  return container
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

  const metersToggle = document.createElement('button')
  metersToggle.className = 'chud-meters-toggle'
  metersToggle.setAttribute('data-touch-blocker-ignore', '')
  const metersLabel = document.createElement('span')
  metersLabel.textContent = 'Global Meters'
  const metersChevron = document.createElement('span')
  metersChevron.className = 'chud-meters-chevron'
  metersChevron.textContent = '\u25bc'
  metersToggle.appendChild(metersLabel)
  metersToggle.appendChild(metersChevron)
  wrapper.appendChild(metersToggle)
  let metersOpen = false
  metersToggle.addEventListener('click', () => {
    metersOpen = !metersOpen
    wrapper.className = 'chud-meters' + (metersOpen ? ' open' : '')
  })

  const metersBody = document.createElement('div')
  metersBody.className = 'chud-meters-body'
  wrapper.appendChild(metersBody)

  const getMeters = () => readMeters()
  const setMeters = (next) => writeMeters(next)

  const gcm = buildGritCollapseMeter(getMeters, setMeters)
  metersBody.appendChild(gcm.container)

  const rows = METERS.map((def) => buildMeterRow(def, getMeters, setMeters))
  rows.forEach((r) => { metersBody.appendChild(r.row) })

  const wallet = buildWalletWidget()
  const parent = hostSection.parentElement
  // Insert after the secondary accordion if it exists, otherwise after approach
  const accordion = parent.querySelector('.secondary-accordion')
  const insertAfter = accordion || hostSection
  parent.insertBefore(wrapper, insertAfter.nextSibling)
  const combatPanel = buildCombatPanel()
  parent.insertBefore(combatPanel, wrapper)
  // Mount wallet OUTSIDE the React root so React re-renders can never interfere with input focus
  const reactRoot = document.getElementById('root')
  reactRoot.parentNode.insertBefore(wallet, reactRoot.nextSibling)

  const refreshAll = () => { gcm.update(); rows.forEach((r) => r.update()) }
  refreshAll()

  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY) refreshAll()
  })

  return true
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
