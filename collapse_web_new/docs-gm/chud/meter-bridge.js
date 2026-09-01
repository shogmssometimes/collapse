const STORAGE_KEY = 'csmatrix.graph'
const WALLET_KEY = 'chud.wallet'
const COMBAT_KEY = 'combat.v1'
const STATUS_ROLLS_KEY = 'chud.statusRolls'
const UI_KEY = 'chud.ui.v1'
const STATUS_ROLL_MAX = 50
const STATUS_ROLL_MAX_ROWS = 10
const STATUS_ROLL_DEFAULT_ROWS = 2
const STATUS_EFFECTS_CATALOG = [
  { name: 'Slowed', effect: 'Any movement costs +1 additional AP' },
  { name: 'Bound', effect: 'Cannot take movement actions' },
  { name: 'Stunned', effect: 'Reduce AP by 1d4' },
  { name: 'Distracted', effect: 'Cannot purchase/use Reaction Tokens' },
  { name: 'Taunted', effect: 'Must target Taunter with Combat Action or lose 2AP' },
  { name: 'Marked', effect: 'Cannot be Hidden' },
  { name: 'Exposed', effect: 'WT reduced by 1' },
  { name: 'Nullified', effect: 'Cannot use Mod Engrams' },
  { name: 'Overheated', effect: 'Cannot use Grit' },
  { name: 'Irradiated', effect: 'Lose 1 Grit' },
  { name: 'Afflicted (Poison, Burn, Suffocation etc)', effect: 'At the bottom of your turn, roll a dice, on evens reduce WT by 1, on odds, nothing happens.' },
  { name: 'Frightened', effect: 'Must remain adjacent to fear source' },
  { name: 'Crushed', effect: 'Double AP Costs' },
  { name: 'Confused', effect: 'Roll twice, take lower' },
  { name: 'Hacked', effect: 'Roll 1d4, control target for that # of Turns' },
  { name: 'Discombobulated', effect: 'Roll 1d4, on 1, Combat Actions hit a random target' },
  { name: 'Focused', effect: 'On rolls, roll twice, take higher' },
  { name: 'Shielded', effect: 'Damage halved' },
  { name: 'Fortified', effect: 'WT increased by 1' },
  { name: 'Hastened', effect: 'Any movement costs 1 less AP' },
  { name: 'Inspired', effect: 'Gain 1 Grit' },
  { name: 'Energized', effect: 'Gain +1AP' },
  { name: 'Overclocked', effect: 'Chip damage die steps up one tier' },
  { name: 'Bleeding', effect: 'On hit, Lose 1HP regardless of WT' },
  { name: 'Charmed', effect: 'Treat source as friendly' },
  { name: 'Demoralized', effect: 'Cannot Ganbare or receive Ganbare' },
  { name: 'Rattled', effect: 'Cannot use Overdrive' },
  { name: 'Pressured', effect: 'Cannot Flank or gain positional bonuses' },
  { name: 'Exhausted', effect: 'Reduce all AO/PCDC rolls by 1d4' },
  { name: 'Downed', effect: 'Out of the fight, must be revived' },
  { name: 'Desynced', effect: 'Your Chip is Desynced' },
]
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
  return { collapse: 0, influence: 0, record: 0, grit: 0 }
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
    .chud-wallet { display: flex; flex-direction: column; gap: 10px; padding-bottom: 10px; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); }
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

    /* ── Short Rest tally ─────────────────────────────────────────────── */
    .chud-tally { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; -webkit-user-select: none; }
    .chud-tally-label { font-size: 13px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(248,250,252,0.65); }
    .chud-tally-marks { display: flex; align-items: center; gap: 6px; color: rgba(15,246,255,0.85); }
    .chud-tally-group { flex-shrink: 0; }

    /* ── Status Rolls Panel ───────────────────────────────────────────── */
    .chud-status-rolls { margin-top: 4px; display: flex; flex-direction: column; gap: 8px; }
    .status-roll-header { display: flex; gap: 6px; padding: 0 2px; }
    .status-roll-header span { font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(248,250,252,0.4); font-weight: 600; }
    .status-roll-header span.col-name { flex: 26 1 0; }
    .status-roll-header span.col-effect { flex: 42 1 0; }
    .status-roll-header span.col-value { flex: 22 1 0; text-align: center; }
    .status-roll-header span.col-clear { flex: 10 1 0; text-align: center; }
    .status-roll-rows { display: flex; flex-direction: column; gap: 6px; }
    .status-roll-row { display: flex; gap: 6px; align-items: stretch; position: relative; }
    .status-roll-name-wrap { position: relative; flex: 26 1 0; min-width: 0; }
    .status-roll-name-input { width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; padding: 7px 8px; font-size: 11px; color: #e9f0ff; outline: none; }
    .status-roll-name-input:focus { border-color: rgba(61,232,192,0.45); }
    .status-roll-suggestions { position: absolute; top: 100%; left: 0; right: 0; margin-top: 3px; background: #0d1117; border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; max-height: 170px; overflow-y: auto; z-index: 30; box-shadow: 0 10px 28px rgba(0,0,0,0.55); }
    .status-roll-suggestion { padding: 8px 10px; font-size: 11px; color: #e9f0ff; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .status-roll-suggestion:last-child { border-bottom: none; }
    .status-roll-suggestion:hover { background: rgba(61,232,192,0.16); }
    .status-roll-effect { flex: 42 1 0; min-width: 0; box-sizing: border-box; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 7px 8px; font-size: 10px; color: rgba(248,250,252,0.8); outline: none; line-height: 1.25; }
    .status-roll-effect[data-readonly="1"] { color: rgba(248,250,252,0.55); font-style: italic; }
    .status-roll-effect:focus { border-color: rgba(61,232,192,0.3); }
    .status-roll-value-wrap { flex: 22 1 0; display: flex; align-items: center; justify-content: center; gap: 4px; }
    .status-roll-value-btn { width: 24px; height: 24px; flex-shrink: 0; border-radius: 6px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.07); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .status-roll-value-btn:active { transform: scale(0.94); }
    .status-roll-value { min-width: 20px; text-align: center; font-variant-numeric: tabular-nums; font-weight: 800; color: #6ac7ff; font-size: 12px; }
    .status-roll-clear { flex: 8.5 1 0; min-width: 26px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.4); background: rgba(239,68,68,0.1); color: #f87171; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
    .status-roll-clear-progress { position: absolute; inset: 0; background: rgba(239,68,68,0.4); width: 0%; pointer-events: none; }
    .status-roll-clear-icon { position: relative; z-index: 1; }
    .status-roll-add { align-self: flex-start; margin-top: 2px; padding: 7px 14px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.26); background: transparent; color: rgba(248,250,252,0.65); font-size: 10px; cursor: pointer; letter-spacing: 0.08em; text-transform: uppercase; }
    .status-roll-add:disabled { opacity: 0.35; cursor: not-allowed; }

    /* ── Combat Panel ──────────────────────────────────────────────── */
    .chud-combat { margin-top: 4px; }
    .chud-combat-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); padding: 6px 0 8px; cursor: pointer; color: rgba(248,250,252,0.65); font-size: 13px; font-family: var(--font-display, inherit); font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
    .chud-combat.open .chud-combat-toggle { color: rgba(248,250,252,0.9); border-bottom-color: rgba(255,255,255,0.18); }
    .chud-combat-chevron { font-size: 9px; opacity: 0.7; }
    .chud-combat-body { display: none; padding: 8px 0 0; }
    .chud-combat-body.open { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
    .combat-body-row { display: flex; gap: 8px; align-items: stretch; }
    .combat-rt { flex: 7 1 0; min-width: 0; cursor: default; user-select: none; -webkit-user-select: none; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); }
    .combat-rt-label { font-weight: 700; font-size: 8px; color: #94a3b8; letter-spacing: 0.06em; text-transform: uppercase; }
    .combat-rt-val { display: none; }
    .combat-rt-pips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; justify-content: center; flex: 1; }
    .combat-rt-pip { width: 14px; height: 14px; border-radius: 50%; background: rgba(255,200,60,0.75); box-shadow: 0 0 8px rgba(255,200,60,0.45); border: 1.5px solid rgba(255,200,60,1); flex-shrink: 0; }
    .combat-rt-none { font-size: 0.75rem; color: rgba(248,250,252,0.3); font-style: italic; }
    .combat-chip-wrap { flex: 3 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
    .combat-chip-toggle { flex: 1; padding: 10px 8px; border: 1px solid rgba(74,222,128,0.4); border-radius: 10px; background: rgba(74,222,128,0.08); color: #4ade80; font-weight: 700; font-size: 10px; letter-spacing: 0.06em; cursor: pointer; transition: background 120ms, border-color 120ms, color 120ms, transform 80ms; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .combat-chip-toggle:active { transform: scale(0.97); }
    .combat-chip-toggle[data-desynced="1"] { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.5); color: #f87171; }

    /* ── Range / Durability / Damage read-only row ── */
    .combat-info-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; align-items: stretch; }
    .combat-info-cell { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 6px; padding: 8px 6px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); }
    .combat-info-cell-label { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(248,250,252,0.45); font-family: var(--font-display, inherit); font-weight: 500; }
    .combat-info-range { display: flex; align-items: center; gap: 6px; }
    .combat-info-range-item { display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .combat-info-range-sublabel { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(248,250,252,0.35); font-family: var(--font-display, inherit); }
    .combat-info-range-val { font-size: 22px; font-weight: 800; color: #0ff6ff; letter-spacing: 0.04em; font-family: var(--font-display, inherit); }
    .combat-info-range-arrow { font-size: 11px; color: rgba(248,250,252,0.3); margin-top: 8px; }
    .combat-info-die { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; border: 2px solid rgba(15,246,255,0.55); background: rgba(15,246,255,0.06); color: #0ff6ff; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; font-family: var(--font-display, inherit); }

    /* ── Queue In Brief ── */
    .combat-queue-brief { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: 8px; background: rgba(8,13,23,0.92); border: 1px solid rgba(255,255,255,0.1); user-select: none; -webkit-user-select: none; touch-action: none; cursor: pointer; transition: border-color 0.3s, box-shadow 0.3s; width: 100%; box-sizing: border-box; }
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
  const container = document.createElement('div')
  container.className = 'chud-wallet'

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
  container.appendChild(header)

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
  container.appendChild(controls)

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

  // Long-press the Reaction Tokens widget to jump to the Combat page and make a selection.
  const RT_HOLD_MS = 900
  let rtHoldTimer = null
  let rtHoldInterval = null
  const cancelRtHold = () => {
    if (rtHoldTimer) { clearTimeout(rtHoldTimer); rtHoldTimer = null }
    if (rtHoldInterval) { clearInterval(rtHoldInterval); rtHoldInterval = null }
    rtSection.style.borderColor = ''
    rtSection.style.boxShadow = ''
  }
  const navigateToCombat = () => {
    try {
      const targetOrigin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : '*'
      window.parent.postMessage({ type: 'collapse-navigate', route: 'combat' }, targetOrigin)
    } catch {}
  }
  rtSection.style.cursor = 'pointer'
  rtSection.title = 'Hold to jump to Combat'
  rtSection.addEventListener('pointerdown', () => {
    const start = Date.now()
    rtHoldInterval = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / RT_HOLD_MS) * 100, 100)
      const glow = pct / 100
      rtSection.style.borderColor = `rgba(255,200,60,${0.2 + 0.6 * glow})`
      rtSection.style.boxShadow = `0 0 ${6 + 16 * glow}px rgba(255,200,60,${0.15 + 0.5 * glow})`
    }, 30)
    rtHoldTimer = setTimeout(() => {
      cancelRtHold()
      navigateToCombat()
    }, RT_HOLD_MS)
  })
  rtSection.addEventListener('pointerup', cancelRtHold)
  rtSection.addEventListener('pointerleave', cancelRtHold)
  rtSection.addEventListener('pointercancel', cancelRtHold)
  rtSection.addEventListener('contextmenu', ev => ev.preventDefault())

  const chipWrap = document.createElement('div')
  chipWrap.className = 'combat-chip-wrap'
  const chipBtn = document.createElement('button')
  chipBtn.className = 'combat-chip-toggle'
  chipBtn.setAttribute('data-touch-blocker-ignore', '')
  chipWrap.appendChild(chipBtn)

  // Range/Damage read-only cells (CR/FR/Damage) have moved to the AAG page,
  // outside this iframe, and are no longer built here.

  // Queue / Reaction Tokens / Chip Sync are relocated into the HP box (see
  // queueSection built further below); they are no longer part of this panel's body.

  // ── Queue In Brief ────────────────────────────────────────────────────────
  const QUEUE_KEY = 'combat.queue.v1'
  const readQueue = () => { try { const r = localStorage.getItem(QUEUE_KEY); return r ? JSON.parse(r) : [] } catch { return [] } }

  const queueBrief = document.createElement('div')
  queueBrief.className = 'combat-queue-brief'
  queueBrief.setAttribute('data-touch-blocker-ignore', '')

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

  const writeQueue = (items) => {
    try {
      const json = JSON.stringify(items)
      localStorage.setItem(QUEUE_KEY, json)
      window.dispatchEvent(new StorageEvent('storage', { key: QUEUE_KEY, newValue: json, storageArea: window.localStorage }))
    } catch {}
  }

  // Long-pressing a queued action "uses" it: remove it from the queue and refund
  // whatever AP or reaction tokens it had reserved, mirroring the Combat page.
  const expendQueueItem = (item) => {
    const items = readQueue()
    const idx = items.findIndex(i => i.id === item.id)
    if (idx === -1) return
    writeQueue(items.slice(0, idx).concat(items.slice(idx + 1)))
    const state = readCombat()
    if (item.mode === 'reaction') {
      writeCombat({ ...state, reactionTokens: (state.reactionTokens || 0) + (item.tokenCost || 0) })
    } else {
      writeCombat({ ...state, spentAp: Math.max(0, (state.spentAp || 0) - (item.ap || 0)) })
    }
    if (queueIdx > 0) queueIdx -= 1
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
        expendQueueItem(items[queueIdx % items.length])
        renderQueueBrief()
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

  const queueSection = document.createElement('div')
  queueSection.className = 'chud-hp-queue-section'
  queueSection.appendChild(queueBrief)
  const rtChipRow = document.createElement('div')
  rtChipRow.className = 'viv-row'
  rtChipRow.appendChild(rtSection)
  rtChipRow.appendChild(chipWrap)
  queueSection.appendChild(rtChipRow)

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
    // queue brief
    renderQueueBrief()
  }

  chipBtn.addEventListener('click', () => {
    const s = readCombat(); writeCombat({ ...s, chipDesynced: !s.chipDesynced }); refresh()
  })

  // ── Short Rest tally ──────────────────────────────────────────────────────
  const CHUD_STATE_KEY = 'chud.state.v1'
  const readTally = (key) => {
    try { const s = JSON.parse(localStorage.getItem(CHUD_STATE_KEY) || '{}'); const v = s[key]; return typeof v === 'number' ? v : 0 } catch { return 0 }
  }
  const writeTally = (key, value) => {
    try { const s = JSON.parse(localStorage.getItem(CHUD_STATE_KEY) || '{}'); s[key] = value; localStorage.setItem(CHUD_STATE_KEY, JSON.stringify(s)) } catch {}
  }
  const makeTallyGroupSVG = (n) => {
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.classList.add('chud-tally-group')
    svg.setAttribute('width', '26')
    svg.setAttribute('height', '20')
    svg.setAttribute('viewBox', '0 0 26 20')
    const barX = [3, 9, 15, 21]
    const shown = Math.min(n, 4)
    for (let i = 0; i < shown; i++) {
      const line = document.createElementNS(svgNS, 'line')
      line.setAttribute('x1', String(barX[i])); line.setAttribute('y1', '2')
      line.setAttribute('x2', String(barX[i])); line.setAttribute('y2', '18')
      line.setAttribute('stroke', 'currentColor'); line.setAttribute('stroke-width', '2'); line.setAttribute('stroke-linecap', 'round')
      svg.appendChild(line)
    }
    if (n >= 5) {
      const diag = document.createElementNS(svgNS, 'line')
      diag.setAttribute('x1', '1'); diag.setAttribute('y1', '18')
      diag.setAttribute('x2', '23'); diag.setAttribute('y2', '2')
      diag.setAttribute('stroke', 'currentColor'); diag.setAttribute('stroke-width', '2'); diag.setAttribute('stroke-linecap', 'round')
      svg.appendChild(diag)
    }
    return svg
  }
  const makeTally = (label, key, max) => {
    const wrap = document.createElement('div')
    wrap.className = 'chud-tally'
    wrap.setAttribute('data-touch-blocker-ignore', '')
    const lbl = document.createElement('span')
    lbl.className = 'chud-tally-label'
    lbl.textContent = label
    const marksWrap = document.createElement('div')
    marksWrap.className = 'chud-tally-marks'
    wrap.appendChild(lbl)
    wrap.appendChild(marksWrap)

    let count = Math.max(0, Math.min(max, readTally(key)))
    const renderMarks = () => {
      marksWrap.innerHTML = ''
      marksWrap.appendChild(makeTallyGroupSVG(Math.max(0, Math.min(5, count))))
      marksWrap.appendChild(makeTallyGroupSVG(Math.max(0, Math.min(5, count - 5))))
    }
    renderMarks()

    wrap.addEventListener('click', (ev) => {
      ev.stopPropagation()
      count = count >= max ? 0 : count + 1
      writeTally(key, count)
      renderMarks()
      window.dispatchEvent(new StorageEvent('storage', { key: CHUD_STATE_KEY, newValue: localStorage.getItem(CHUD_STATE_KEY) }))
    })

    const sync = () => { count = Math.max(0, Math.min(max, readTally(key))); renderMarks() }
    window.addEventListener('storage', (ev) => { if (ev.key === CHUD_STATE_KEY) sync() })

    return wrap
  }
  // Short Rest is a tally (0-10), mounted separately in Page 2. Push It has
  // been removed entirely.
  const shortRestFlag = makeTally('Short Rest', 'shortRestTally', 10)
  // ── end flags ─────────────────────────────────────────────────────────────

  refresh()
  window.addEventListener('storage', (ev) => { if (ev.key === COMBAT_KEY || ev.key === QUEUE_KEY) refresh() })
  return { queueSection, shortRestFlag }
}

function readStatusRolls() {
  try {
    const raw = localStorage.getItem(STATUS_ROLLS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    // New format
    if (Array.isArray(parsed?.rows)) return parsed.rows
    // Back-compat: array at root
    if (Array.isArray(parsed)) return parsed
    // Back-compat: old key/value map { marked: 1, ... }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([name, roll], idx) => ({
        id: `legacy-${idx}`,
        name,
        effect: '',
        roll: Number.isFinite(roll) ? roll : 0,
      }))
    }
    return []
  } catch { return [] }
}

function writeStatusRolls(next) {
  try {
    const json = JSON.stringify({ rows: next })
    localStorage.setItem(STATUS_ROLLS_KEY, json)
  } catch {}
}

function buildStatusRollsPanel() {
  const normalizeName = (s) => String(s || '').trim().toLowerCase()
  const byName = new Map(STATUS_EFFECTS_CATALOG.map((it) => [normalizeName(it.name), it]))
  const clampStatusRoll = (n) => Math.max(0, Math.min(STATUS_ROLL_MAX, Number.isFinite(n) ? n : 0))
  const newRow = () => ({ id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', effect: '', roll: 0 })
  const hydrateRows = (rows) => {
    const safe = (Array.isArray(rows) ? rows : []).slice(0, STATUS_ROLL_MAX_ROWS).map((row, idx) => {
      const name = String(row?.name || '')
      const exact = byName.get(normalizeName(name))
      const effect = exact ? exact.effect : String(row?.effect || '')
      return {
        id: String(row?.id || `sr-${idx}`),
        name,
        effect,
        roll: clampStatusRoll(Number(row?.roll ?? 0)),
      }
    })
    while (safe.length < STATUS_ROLL_DEFAULT_ROWS) safe.push(newRow())
    return safe
  }
  const getSuggestions = (query) => {
    const q = normalizeName(query)
    if (!q) return []
    return STATUS_EFFECTS_CATALOG
      .filter((it) => normalizeName(it.name).includes(q))
      .sort((a, b) => {
        const aStarts = normalizeName(a.name).startsWith(q) ? 0 : 1
        const bStarts = normalizeName(b.name).startsWith(q) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        return a.name.localeCompare(b.name)
      })
      .slice(0, 6)
  }

  let rows = hydrateRows(readStatusRolls())
  const container = document.createElement('div')
  container.className = 'chud-status-rolls'

  const header = document.createElement('div')
  header.className = 'status-roll-header'
  header.innerHTML = '<span class="col-name">Name</span><span class="col-effect">Effect</span><span class="col-value">Set Roll</span><span class="col-clear">Clear</span>'
  container.appendChild(header)

  const rowsWrap = document.createElement('div')
  rowsWrap.className = 'status-roll-rows'
  container.appendChild(rowsWrap)

  const addBtn = document.createElement('button')
  addBtn.className = 'status-roll-add'
  addBtn.textContent = 'Add Row'
  addBtn.setAttribute('data-touch-blocker-ignore', '')
  container.appendChild(addBtn)

  const persist = () => writeStatusRolls(rows)

  const renderRows = () => {
    rowsWrap.innerHTML = ''
    rows.forEach((row, idx) => {
      const rowEl = document.createElement('div')
      rowEl.className = 'status-roll-row'

      const nameWrap = document.createElement('div')
      nameWrap.className = 'status-roll-name-wrap'

      const nameInput = document.createElement('input')
      nameInput.type = 'text'
      nameInput.className = 'status-roll-name-input'
      nameInput.placeholder = 'Type effect name...'
      nameInput.value = row.name
      nameInput.autocomplete = 'off'
      nameInput.setAttribute('data-touch-blocker-ignore', '')

      const suggestionsEl = document.createElement('div')
      suggestionsEl.className = 'status-roll-suggestions'
      suggestionsEl.style.display = 'none'

      const renderSuggestions = () => {
        const list = getSuggestions(nameInput.value)
        suggestionsEl.innerHTML = ''
        if (!nameInput.value.trim() || list.length === 0) {
          suggestionsEl.style.display = 'none'
          return
        }
        list.forEach((item) => {
          const option = document.createElement('div')
          option.className = 'status-roll-suggestion'
          option.textContent = item.name
          option.addEventListener('pointerdown', (ev) => {
            ev.preventDefault()
            row.name = item.name
            row.effect = item.effect
            nameInput.value = item.name
            effectInput.value = item.effect
            effectInput.readOnly = true
            effectInput.dataset.readonly = '1'
            suggestionsEl.style.display = 'none'
            persist()
          })
          suggestionsEl.appendChild(option)
        })
        suggestionsEl.style.display = 'block'
      }

      const effectInput = document.createElement('textarea')
      effectInput.className = 'status-roll-effect'
      effectInput.rows = 2
      effectInput.setAttribute('data-touch-blocker-ignore', '')
      const exact = byName.get(normalizeName(row.name))
      if (exact) {
        row.effect = exact.effect
        effectInput.value = exact.effect
        effectInput.readOnly = true
        effectInput.dataset.readonly = '1'
      } else {
        effectInput.value = row.effect
        effectInput.readOnly = false
        effectInput.dataset.readonly = '0'
      }

      nameInput.addEventListener('input', () => {
        row.name = nameInput.value
        const match = byName.get(normalizeName(row.name))
        if (match) {
          row.effect = match.effect
          effectInput.value = match.effect
          effectInput.readOnly = true
          effectInput.dataset.readonly = '1'
        } else {
          if (effectInput.readOnly) {
            row.effect = ''
            effectInput.value = ''
          }
          effectInput.readOnly = false
          effectInput.dataset.readonly = '0'
        }
        renderSuggestions()
        persist()
      })

      nameInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          const first = getSuggestions(nameInput.value)[0]
          if (first) {
            ev.preventDefault()
            row.name = first.name
            row.effect = first.effect
            nameInput.value = first.name
            effectInput.value = first.effect
            effectInput.readOnly = true
            effectInput.dataset.readonly = '1'
            suggestionsEl.style.display = 'none'
            persist()
          }
        }
      })

      nameInput.addEventListener('focus', () => renderSuggestions())
      nameInput.addEventListener('blur', () => {
        setTimeout(() => { suggestionsEl.style.display = 'none' }, 120)
      })

      effectInput.addEventListener('input', () => {
        if (effectInput.readOnly) return
        row.effect = effectInput.value
        persist()
      })

      nameWrap.appendChild(nameInput)
      nameWrap.appendChild(suggestionsEl)

      const valueWrap = document.createElement('div')
      valueWrap.className = 'status-roll-value-wrap'
      const minus = document.createElement('button')
      minus.className = 'status-roll-value-btn'
      minus.textContent = '-'
      minus.setAttribute('data-touch-blocker-ignore', '')
      const val = document.createElement('span')
      val.className = 'status-roll-value'
      val.textContent = String(row.roll)
      const plus = document.createElement('button')
      plus.className = 'status-roll-value-btn'
      plus.textContent = '+'
      plus.setAttribute('data-touch-blocker-ignore', '')

      minus.addEventListener('click', () => {
        row.roll = clampStatusRoll(row.roll - 1)
        val.textContent = String(row.roll)
        persist()
      })
      plus.addEventListener('click', () => {
        row.roll = clampStatusRoll(row.roll + 1)
        val.textContent = String(row.roll)
        persist()
      })

      valueWrap.appendChild(minus)
      valueWrap.appendChild(val)
      valueWrap.appendChild(plus)

      const clearBtn = document.createElement('button')
      clearBtn.className = 'status-roll-clear'
      clearBtn.setAttribute('data-touch-blocker-ignore', '')
      const clearProgress = document.createElement('span')
      clearProgress.className = 'status-roll-clear-progress'
      const clearIcon = document.createElement('span')
      clearIcon.className = 'status-roll-clear-icon'
      clearIcon.textContent = 'X'
      clearBtn.appendChild(clearProgress)
      clearBtn.appendChild(clearIcon)

      let holdTimer = null
      let holdTick = null
      const HOLD_MS = 700
      const clearHold = () => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null }
        if (holdTick) { clearInterval(holdTick); holdTick = null }
        clearProgress.style.width = '0%'
      }
      clearBtn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault()
        const started = Date.now()
        holdTick = setInterval(() => {
          const pct = Math.min(100, ((Date.now() - started) / HOLD_MS) * 100)
          clearProgress.style.width = `${pct}%`
        }, 30)
        holdTimer = setTimeout(() => {
          clearHold()
          rows.splice(idx, 1)
          renderRows()
          persist()
        }, HOLD_MS)
      })
      ;['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
        clearBtn.addEventListener(evt, clearHold)
      })

      rowEl.appendChild(nameWrap)
      rowEl.appendChild(effectInput)
      rowEl.appendChild(valueWrap)
      rowEl.appendChild(clearBtn)
      rowsWrap.appendChild(rowEl)
    })
    addBtn.disabled = rows.length >= STATUS_ROLL_MAX_ROWS
  }

  addBtn.addEventListener('click', () => {
    if (rows.length >= STATUS_ROLL_MAX_ROWS) return
    rows.push(newRow())
    renderRows()
    persist()
  })

  renderRows()

  window.addEventListener('storage', (ev) => {
    if (ev.key !== STATUS_ROLLS_KEY) return
    rows = hydrateRows(readStatusRolls())
    renderRows()
  })

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
  if (panel.querySelector('.gcm')) return true

  const getMeters = () => readMeters()
  const setMeters = (next) => writeMeters(next)

  // Grit/Collapse meter is extracted from Global Meters and mounted at its
  // own anchor below Gear Mgmt (see chud-gcm-anchor below). Global Meters
  // (Record/Influence) box has been removed entirely.
  const gcm = buildGritCollapseMeter(getMeters, setMeters)

  // Set Rolls (Status Effects) mounts inside the HP box, directly below the
  // Reaction Tokens/Chip Sync row. Combat box (CR/FR) has been removed
  // entirely; CR/FR now render read-only on the standalone AAG page, outside
  // this iframe. Page 2 (including Damage die + Short Rest) also lives on
  // the AAG page. Wallet + Reps now live on the standalone MGR page.
  const { queueSection } = buildCombatPanel()
  const statusRollsPanel = buildStatusRollsPanel()
  const setRollsAnchor = panel.querySelector('#chud-setrolls-anchor')
  if (setRollsAnchor) {
    setRollsAnchor.insertAdjacentElement('afterend', statusRollsPanel)
  } else {
    panel.appendChild(statusRollsPanel)
  }
  const gcmAnchor = panel.querySelector('#chud-gcm-anchor')
  if (gcmAnchor) {
    gcmAnchor.insertAdjacentElement('afterend', gcm.container)
  } else {
    panel.appendChild(gcm.container)
  }
  // Queue / Reaction Tokens / Chip Sync mount inside the HP box, directly
  // below the HP bar.
  const hpQueueAnchor = panel.querySelector('#chud-hp-queue-anchor')
  if (hpQueueAnchor) {
    hpQueueAnchor.insertAdjacentElement('afterend', queueSection)
  }

  const refreshAll = () => { gcm.update() }
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
