const STORAGE_KEY = 'csmatrix.graph'
const WALLET_KEY = 'chud.wallet'
const COMBAT_KEY = 'combat.v1'
const UI_KEY = 'chud.ui.v1'
function readUI() {
  try { const r = localStorage.getItem(UI_KEY); return r ? JSON.parse(r) : {} } catch { return {} }
}
function writeUIKey(key, val) {
  try { localStorage.setItem(UI_KEY, JSON.stringify({ ...readUI(), [key]: val })) } catch {}
}
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
    .chud-meters-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); padding: 6px 0 8px; cursor: pointer; color: rgba(248,250,252,0.65); font-size: 13px; font-family: var(--font-display, inherit); font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
    .chud-meters.open .chud-meters-toggle { color: rgba(248,250,252,0.9); border-bottom-color: rgba(255,255,255,0.18); }
    .chud-meters-chevron { font-size: 9px; opacity: 0.7; }
    .chud-meters-body { display: none; padding: 8px 0 0; display: none; flex-direction: column; gap: 10px; }
    .chud-meters.open .chud-meters-body { display: flex; }
    .chud-wallet { margin-top: 4px; }
    .chud-wallet-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); padding: 6px 0 8px; cursor: pointer; color: rgba(248,250,252,0.65); font-size: 13px; font-family: var(--font-display, inherit); font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
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
    .chud-combat-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); padding: 6px 0 8px; cursor: pointer; color: rgba(248,250,252,0.65); font-size: 13px; font-family: var(--font-display, inherit); font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
    .chud-combat.open .chud-combat-toggle { color: rgba(248,250,252,0.9); border-bottom-color: rgba(255,255,255,0.18); }
    .chud-combat-chevron { font-size: 9px; opacity: 0.7; }
    .chud-combat-body { display: none; padding: 8px 0 0; }
    .chud-combat-flags { display: flex; flex-direction: row; gap: 8px; align-items: stretch; }
    .chud-combat-body.open { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
    .combat-body-row { display: flex; gap: 8px; align-items: stretch; }
    .combat-rt { flex: 26 1 0; min-width: 0; cursor: default; user-select: none; -webkit-user-select: none; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); }
    .combat-rt-label { font-weight: 700; font-size: 8px; color: #94a3b8; letter-spacing: 0.06em; text-transform: uppercase; }
    .combat-rt-val { display: none; }
    .combat-rt-pips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; justify-content: center; flex: 1; }
    .combat-rt-pip { width: 14px; height: 14px; border-radius: 50%; background: rgba(255,200,60,0.75); box-shadow: 0 0 8px rgba(255,200,60,0.45); border: 1.5px solid rgba(255,200,60,1); flex-shrink: 0; }
    .combat-rt-none { font-size: 0.75rem; color: rgba(248,250,252,0.3); font-style: italic; }
    .combat-chip-wrap { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
    .combat-chip-toggle { flex: 1; padding: 10px 8px; border: 1px solid rgba(74,222,128,0.4); border-radius: 10px; background: rgba(74,222,128,0.08); color: #4ade80; font-weight: 700; font-size: 10px; letter-spacing: 0.06em; cursor: pointer; transition: background 120ms, border-color 120ms, color 120ms, transform 80ms; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .combat-chip-toggle:active { transform: scale(0.97); }
    .combat-chip-toggle[data-desynced="1"] { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.5); color: #f87171; }

    /* ── Range / Durability / Damage read-only row ── */
    .combat-info-row { display: grid; grid-template-columns: 0.7fr 0.7fr 0.8fr 0.8fr 1fr; gap: 6px; align-items: stretch; }
    .combat-info-cell { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 6px; padding: 8px 6px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); }
    .combat-info-cell-label { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(248,250,252,0.45); font-family: var(--font-display, inherit); font-weight: 500; }
    .combat-info-range { display: flex; align-items: center; gap: 6px; }
    .combat-info-range-item { display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .combat-info-range-sublabel { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(248,250,252,0.35); font-family: var(--font-display, inherit); }
    .combat-info-range-val { font-size: 22px; font-weight: 800; color: #0ff6ff; letter-spacing: 0.04em; font-family: var(--font-display, inherit); }
    .combat-info-range-arrow { font-size: 11px; color: rgba(248,250,252,0.3); margin-top: 8px; }
    .combat-info-die { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; border: 2px solid rgba(15,246,255,0.55); background: rgba(15,246,255,0.06); color: #0ff6ff; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; font-family: var(--font-display, inherit); }

    /* ── Queue In Brief ── */
    .combat-queue-brief { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: 8px; background: rgba(8,13,23,0.92); border: 1px solid rgba(255,255,255,0.1); user-select: none; -webkit-user-select: none; touch-action: none; cursor: pointer; transition: border-color 0.3s, box-shadow 0.3s; flex: 74 1 0; min-width: 0; }
    .combat-queue-brief-eyebrow { font-size: 0.58rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(248,250,252,0.45); text-align: center; }
    .combat-queue-brief-row { display: flex; align-items: baseline; justify-content: center; gap: 6px; min-width: 0; overflow: hidden; }
    .combat-queue-brief-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.88rem; font-weight: 600; color: rgba(255,255,255,0.95); text-align: center; }
    .combat-queue-brief-badge { font-size: 0.75rem; font-variant-numeric: tabular-nums; flex-shrink: 0; color: #0ff6ff; }
    .combat-queue-brief-badge.reaction { color: rgba(255,200,60,0.95); }
    .combat-queue-brief-page { font-size: 0.6rem; color: rgba(248,250,252,0.3); text-align: center; letter-spacing: 0.06em; }
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
  let open = readUI().walletOpen ?? true
  const container = document.createElement('div')
  container.className = 'chud-wallet' + (open ? ' open' : '')

  const toggleBtn = document.createElement('button')
  toggleBtn.className = 'chud-wallet-toggle'
  toggleBtn.setAttribute('data-touch-blocker-ignore', '')
  const toggleLabel = document.createElement('span')
  toggleLabel.textContent = 'Wallet'
  const chevron = document.createElement('span')
  chevron.className = 'chud-wallet-chevron'
  chevron.textContent = open ? '\u25b2' : '\u25bc'
  toggleBtn.appendChild(toggleLabel)
  toggleBtn.appendChild(chevron)
  container.appendChild(toggleBtn)

  toggleBtn.addEventListener('click', () => {
    open = !open
    container.className = 'chud-wallet' + (open ? ' open' : '')
    chevron.className = 'chud-wallet-chevron' + (open ? ' open' : '')
    chevron.textContent = open ? '\u25b2' : '\u25bc'
    writeUIKey('walletOpen', open)
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
  try {
    const json = JSON.stringify(state)
    localStorage.setItem(COMBAT_KEY, json)
    window.dispatchEvent(new StorageEvent('storage', { key: COMBAT_KEY, newValue: json, storageArea: window.localStorage }))
  } catch {}
}

function buildCombatPanel() {
  let open = readUI().combatOpen ?? true
  const container = document.createElement('div')
  container.className = 'chud-combat' + (open ? ' open' : '')

  const toggleBtn = document.createElement('button')
  toggleBtn.className = 'chud-combat-toggle'
  toggleBtn.setAttribute('data-touch-blocker-ignore', '')
  const toggleLabel = document.createElement('span')
  toggleLabel.textContent = 'Combat'
  const chevron = document.createElement('span')
  chevron.className = 'chud-combat-chevron'
  chevron.textContent = open ? '\u25b2' : '\u25bc'
  toggleBtn.appendChild(toggleLabel)
  toggleBtn.appendChild(chevron)
  container.appendChild(toggleBtn)

  const body = document.createElement('div')
  body.className = 'chud-combat-body' + (open ? ' open' : '')

  const rtSection = document.createElement('div')
  rtSection.className = 'combat-rt'
  rtSection.setAttribute('data-touch-blocker-ignore', '')

  const rtLabel = document.createElement('span')
  rtLabel.className = 'combat-rt-label'
  rtLabel.textContent = 'Reaction Tokens'
  const rtVal = document.createElement('span')
  rtVal.className = 'combat-rt-val'

  const rtPips = document.createElement('div')
  rtPips.className = 'combat-rt-pips'

  rtSection.appendChild(rtLabel)
  rtSection.appendChild(rtVal)
  rtSection.appendChild(rtPips)

  const chipWrap = document.createElement('div')
  chipWrap.className = 'combat-chip-wrap'
  const chipBtn = document.createElement('button')
  chipBtn.className = 'combat-chip-toggle'
  chipBtn.setAttribute('data-touch-blocker-ignore', '')
  chipWrap.appendChild(chipBtn)

  // ── Range / Durability / Damage read-only row ──────────────────────────────
  const infoRow = document.createElement('div')
  infoRow.className = 'combat-info-row'

  // CR cell
  const crCell = document.createElement('div')
  crCell.className = 'combat-info-cell'
  const crLbl = document.createElement('span'); crLbl.className = 'combat-info-cell-label'; crLbl.textContent = 'CR'
  const crVal = document.createElement('span'); crVal.className = 'combat-info-range-val'
  crCell.appendChild(crLbl); crCell.appendChild(crVal)

  // FR cell
  const frCell = document.createElement('div')
  frCell.className = 'combat-info-cell'
  const frLbl = document.createElement('span'); frLbl.className = 'combat-info-cell-label'; frLbl.textContent = 'FR'
  const frVal = document.createElement('span'); frVal.className = 'combat-info-range-val'
  frCell.appendChild(frLbl); frCell.appendChild(frVal)

  // Durability cell
  const duraCell = document.createElement('div')
  duraCell.className = 'combat-info-cell'
  const duraLbl = document.createElement('span'); duraLbl.className = 'combat-info-cell-label'; duraLbl.textContent = 'Dura'
  const duraDie = document.createElement('div'); duraDie.className = 'combat-info-die'
  duraCell.appendChild(duraLbl); duraCell.appendChild(duraDie)

  // Damage cell
  const dmgCell = document.createElement('div')
  dmgCell.className = 'combat-info-cell'
  const dmgLbl = document.createElement('span'); dmgLbl.className = 'combat-info-cell-label'; dmgLbl.textContent = 'DMG'
  const dmgDie = document.createElement('div'); dmgDie.className = 'combat-info-die'
  dmgCell.appendChild(dmgLbl); dmgCell.appendChild(dmgDie)

  infoRow.appendChild(crCell); infoRow.appendChild(frCell); infoRow.appendChild(duraCell); infoRow.appendChild(dmgCell); infoRow.appendChild(chipWrap)
  body.appendChild(infoRow)

  // ── Row 2: Queue | Tokens ─────────────────────────────────────────────────
  const row2 = document.createElement('div')
  row2.className = 'combat-body-row'
  body.appendChild(row2)

  // ── Queue In Brief ────────────────────────────────────────────────────────
  const QUEUE_KEY = 'combat.queue.v1'
  const readQueue = () => { try { const r = localStorage.getItem(QUEUE_KEY); return r ? JSON.parse(r) : [] } catch { return [] } }

  const queueBrief = document.createElement('div')
  queueBrief.className = 'combat-queue-brief'
  queueBrief.setAttribute('data-touch-blocker-ignore', '')
  row2.appendChild(queueBrief)

  let queueIdx = 0
  let qBriefHoldTimer = null
  let qBriefHoldInterval = null
  let qBriefHoldProgress = 0
  let qBriefSwipeStartX = null
  let qBriefHoldFired = false
  const QUEUE_HOLD_MS = 1800

  const formatActionName = (action) => {
    if (action === 'Unspent Reaction Tokens') return 'Reaction Token (Unspent)'
    return action
  }

  const showQueuePopup = (item) => {
    const existing = document.getElementById('chud-queue-popup')
    if (existing) existing.remove()
    const overlay = document.createElement('div')
    overlay.id = 'chud-queue-popup'
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:24px;touch-action:none;'
    const card = document.createElement('div')
    card.style.cssText = 'background:#0d1117;border:1px solid rgba(15,246,255,0.25);border-radius:14px;padding:22px 24px;max-width:300px;width:100%;box-shadow:0 0 40px rgba(15,246,255,0.12);display:flex;flex-direction:column;gap:10px;'
    const eyebrow = document.createElement('span')
    eyebrow.style.cssText = 'font-size:0.6rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(248,250,252,0.4);text-align:center;'
    eyebrow.textContent = item.mode === 'reaction' ? 'Reaction Action' : 'Queue Item'
    const title = document.createElement('div')
    title.style.cssText = 'font-size:1.05rem;font-weight:700;color:#f8fafc;text-align:center;line-height:1.3;'
    title.textContent = formatActionName(item.action)
    const cost = document.createElement('div')
    cost.style.cssText = `font-size:0.95rem;font-weight:600;text-align:center;color:${item.mode === 'reaction' ? 'rgba(255,200,60,0.9)' : '#0ff6ff'};`
    cost.textContent = item.mode === 'reaction'
      ? `${item.tokenCost} Reaction Token${item.tokenCost !== 1 ? 's' : ''}`
      : `${item.ap} AP`
    const dismiss = document.createElement('div')
    dismiss.style.cssText = 'font-size:0.6rem;color:rgba(248,250,252,0.25);text-align:center;letter-spacing:0.12em;text-transform:uppercase;margin-top:6px;'
    dismiss.textContent = 'tap to dismiss'
    card.appendChild(eyebrow); card.appendChild(title); card.appendChild(cost); card.appendChild(dismiss)
    overlay.appendChild(card)
    document.body.appendChild(overlay)
    overlay.addEventListener('pointerdown', () => overlay.remove(), { once: true })
  }

  const cancelQBriefHold = () => {
    if (qBriefHoldTimer) { clearTimeout(qBriefHoldTimer); qBriefHoldTimer = null }
    if (qBriefHoldInterval) { clearInterval(qBriefHoldInterval); qBriefHoldInterval = null }
    qBriefHoldProgress = 0
    renderQueueBrief()
  }

  const renderQueueBrief = () => {
    const items = readQueue()
    queueBrief.innerHTML = ''
    queueBrief.style.display = 'flex'
    if (!items.length) {
      queueBrief.style.borderColor = 'rgba(255,255,255,0.07)'
      queueBrief.style.boxShadow = 'none'
      const eyebrow = document.createElement('span')
      eyebrow.className = 'combat-queue-brief-eyebrow'
      eyebrow.textContent = 'Queue'
      const empty = document.createElement('span')
      empty.className = 'combat-queue-brief-name'
      empty.style.cssText = 'font-style:italic;color:rgba(248,250,252,0.25);font-size:0.78rem;text-align:center;'
      empty.textContent = 'no actions queued'
      queueBrief.appendChild(eyebrow)
      queueBrief.appendChild(empty)
      return
    }
    const safeIdx = items.length > 0 ? queueIdx % items.length : 0
    const item = items[safeIdx]
    const glow = qBriefHoldProgress / 100
    queueBrief.style.borderColor = qBriefHoldProgress > 0
      ? `rgba(255,90,90,${0.3 + 0.7 * glow})`
      : 'rgba(255,255,255,0.1)'
    queueBrief.style.boxShadow = qBriefHoldProgress > 0
      ? `0 0 ${6 + 20 * glow}px rgba(255,90,90,${0.2 + 0.5 * glow})`
      : 'none'

    const eyebrow = document.createElement('span')
    eyebrow.className = 'combat-queue-brief-eyebrow'
    eyebrow.textContent = 'Queue'

    const row = document.createElement('div')
    row.className = 'combat-queue-brief-row'

    const name = document.createElement('span')
    name.className = 'combat-queue-brief-name'
    name.textContent = formatActionName(item.action)

    const badge = document.createElement('span')
    badge.className = 'combat-queue-brief-badge' + (item.mode === 'reaction' ? ' reaction' : '')
    badge.textContent = item.mode === 'reaction' ? `${item.tokenCost}T` : `${item.ap}AP`

    row.appendChild(name); row.appendChild(badge)

    const pagination = document.createElement('span')
    pagination.className = 'combat-queue-brief-page'
    pagination.textContent = `${safeIdx + 1} / ${items.length}`

    queueBrief.appendChild(eyebrow)
    queueBrief.appendChild(row)
    queueBrief.appendChild(pagination)
  }

  queueBrief.addEventListener('pointerdown', (ev) => {
    qBriefSwipeStartX = ev.clientX
    qBriefHoldProgress = 0
    qBriefHoldFired = false
    const start = Date.now()
    qBriefHoldInterval = setInterval(() => {
      qBriefHoldProgress = Math.min(((Date.now() - start) / QUEUE_HOLD_MS) * 100, 100)
      renderQueueBrief()
    }, 30)
    qBriefHoldTimer = setTimeout(() => {
      qBriefHoldFired = true
      cancelQBriefHold()
      const items = readQueue()
      if (items.length > 0) {
        showQueuePopup(items[queueIdx % items.length])
      }
    }, QUEUE_HOLD_MS)
  })
  queueBrief.addEventListener('pointerup', (ev) => {
    const dx = qBriefSwipeStartX !== null ? ev.clientX - qBriefSwipeStartX : 0
    const fired = qBriefHoldFired
    cancelQBriefHold()
    if (!fired && Math.abs(dx) < 28) {
      const items = readQueue()
      if (items.length > 1) {
        queueIdx = (queueIdx + 1) % items.length
        renderQueueBrief()
      }
    }
    qBriefSwipeStartX = null
  })
  queueBrief.addEventListener('pointerleave', () => { cancelQBriefHold(); qBriefSwipeStartX = null })
  queueBrief.addEventListener('pointercancel', () => { cancelQBriefHold(); qBriefSwipeStartX = null })
  queueBrief.addEventListener('contextmenu', (ev) => ev.preventDefault())

  row2.appendChild(rtSection)
  container.appendChild(body)

  const refresh = () => {
    const state = readCombat()
    const tokens = Math.max(0, Math.min(6, state.reactionTokens ?? 0))
    rtVal.textContent = tokens
    rtPips.innerHTML = ''
    for (let i = 0; i < tokens; i++) {
      const pip = document.createElement('span')
      pip.className = 'combat-rt-pip active'
      rtPips.appendChild(pip)
    }
    if (tokens === 0) {
      const none = document.createElement('span')
      none.className = 'combat-rt-none'
      none.textContent = 'none'
      rtPips.appendChild(none)
    }
    const desynced = !!state.chipDesynced
    chipBtn.innerHTML = desynced ? 'Chip<br>Desynced' : 'Chip<br>Synced'
    chipBtn.dataset.desynced = desynced ? '1' : '0'
    // range
    const swapped = !!state.rangeSwapped
    crVal.textContent = swapped ? '\u22124' : '0'
    frVal.textContent = swapped ? '0' : '\u22124'
    // dice
    duraDie.textContent = (state.durability || 'd6').toUpperCase()
    dmgDie.textContent  = (state.damage    || 'd4').toUpperCase()
    // queue brief
    renderQueueBrief()
  }

  toggleBtn.addEventListener('click', () => {
    open = !open
    container.className = 'chud-combat' + (open ? ' open' : '')
    body.className = 'chud-combat-body' + (open ? ' open' : '')
    chevron.className = 'chud-combat-chevron' + (open ? ' open' : '')
    chevron.textContent = open ? '\u25b2' : '\u25bc'
    writeUIKey('combatOpen', open)
  })

  chipBtn.addEventListener('click', () => {
    const s = readCombat(); writeCombat({ ...s, chipDesynced: !s.chipDesynced }); refresh()
  })

  // ── Short Rest + Push It flags ────────────────────────────────────────────
  const CHUD_STATE_KEY = 'chud.state.v1'
  const readChudFlags = () => {
    try { const s = JSON.parse(localStorage.getItem(CHUD_STATE_KEY) || '{}'); return { shortRest: !!s.shortRest, pushIt: !!s.pushIt } } catch { return { shortRest: false, pushIt: false } }
  }
  const writeChudFlag = (key, value) => {
    try { const s = JSON.parse(localStorage.getItem(CHUD_STATE_KEY) || '{}'); s[key] = value; localStorage.setItem(CHUD_STATE_KEY, JSON.stringify(s)) } catch {}
  }
  const flagsRow = document.createElement('div')
  flagsRow.className = 'chud-combat-flags'
  const makeFlag = (label, key) => {
    const wrap = document.createElement('label')
    wrap.className = 'chud-flag'
    wrap.setAttribute('data-touch-blocker-ignore', '')
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = readChudFlags()[key]
    const box = document.createElement('span')
    box.className = 'chud-flag-box'
    const lbl = document.createElement('span')
    lbl.className = 'chud-flag-label'
    lbl.textContent = label
    wrap.appendChild(cb); wrap.appendChild(box); wrap.appendChild(lbl)
    wrap.addEventListener('click', (ev) => { ev.stopPropagation() })
    cb.addEventListener('change', () => {
      writeChudFlag(key, cb.checked)
      wrap.classList.toggle('checked', cb.checked)
      window.dispatchEvent(new StorageEvent('storage', { key: CHUD_STATE_KEY, newValue: localStorage.getItem(CHUD_STATE_KEY) }))
    })
    const syncFlag = () => { const v = readChudFlags()[key]; cb.checked = v; wrap.classList.toggle('checked', v) }
    window.addEventListener('storage', (ev) => { if (ev.key === CHUD_STATE_KEY) syncFlag() })
    if (cb.checked) wrap.classList.add('checked')
    return wrap
  }
  flagsRow.appendChild(makeFlag('Short Rest', 'shortRest'))
  flagsRow.appendChild(makeFlag('Push It', 'pushIt'))
  body.appendChild(flagsRow)
  // ── end flags ─────────────────────────────────────────────────────────────

  refresh()
  window.addEventListener('storage', (ev) => { if (ev.key === COMBAT_KEY || ev.key === QUEUE_KEY) refresh() })
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
  const panel = root.querySelector('.panel')
  if (!panel) return false
  if (panel.querySelector('.chud-meters')) return true

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
  let metersOpen = readUI().metersOpen ?? true
  wrapper.className = 'chud-meters' + (metersOpen ? ' open' : '')
  metersChevron.textContent = metersOpen ? '\u25b2' : '\u25bc'
  metersToggle.addEventListener('click', () => {
    metersOpen = !metersOpen
    wrapper.className = 'chud-meters' + (metersOpen ? ' open' : '')
    metersChevron.textContent = metersOpen ? '\u25b2' : '\u25bc'
    writeUIKey('metersOpen', metersOpen)
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
  // Always append at end so React re-renders of accordion state can't shift position
  const combatPanel = buildCombatPanel()
  panel.appendChild(combatPanel)
  panel.appendChild(wrapper)
  panel.appendChild(wallet)

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
