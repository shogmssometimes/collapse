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
    .status-roll-header span.col-dir { flex: 11 1 0; text-align: center; }
    .status-roll-header span.col-name { flex: 26 1 0; }
    .status-roll-header span.col-effect { flex: 42 1 0; }
    .status-roll-header span.col-value { flex: 22 1 0; text-align: center; }
    .status-roll-header span.col-clear { flex: 10 1 0; text-align: center; }
    .status-roll-rows { display: flex; flex-direction: column; gap: 6px; }
    .status-roll-row { display: flex; flex-direction: column; gap: 4px; position: relative; }
    .status-roll-row-main { display: flex; gap: 6px; align-items: stretch; }
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

    /* ── Set Roll direction (applied by you vs applied to you) ───────── */
    .status-roll-direction { flex: 13 1 0; min-width: 40px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.05); color: rgba(248,250,252,0.75); font-size: 8px; font-weight: 700; letter-spacing: 0.02em; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 2px; text-align: center; }
    .status-roll-direction[data-dir="in"] { border-color: rgba(111,165,255,0.45); color: #8fb4ff; background: rgba(111,165,255,0.1); }
    .status-roll-direction[data-dir="out"] { border-color: rgba(242,208,107,0.45); color: #f2d06b; background: rgba(242,208,107,0.1); }
    .status-roll-direction[data-holding="1"] { outline: 2px solid rgba(111,165,255,0.6); outline-offset: 1px; }

    /* ── Save/Decay modal (opened via long-press on the Dir button) ──── */
    .status-roll-save-overlay { position: fixed; inset: 0; z-index: 4000; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .status-roll-save-modal { width: 100%; max-width: 280px; background: #15181f; border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; padding: 16px; position: relative; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
    .status-roll-save-modal-close { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 7px; border: 1px solid rgba(239,68,68,0.4); background: rgba(239,68,68,0.1); color: #f87171; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .status-roll-save-modal-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(248,250,252,0.7); margin-bottom: 4px; }
    .status-roll-save-modal-name { font-size: 14px; font-weight: 700; color: #e9f0ff; margin-bottom: 2px; }
    .status-roll-save-modal-target { font-size: 10px; color: rgba(248,250,252,0.55); margin-bottom: 12px; }
    .status-roll-save-modal-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
    .status-roll-save-modal-select { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); border-radius: 7px; color: #e9f0ff; font-size: 11px; padding: 7px 6px; }
    .status-roll-save-btn { padding: 7px 14px; border-radius: 7px; border: 1px solid rgba(111,165,255,0.4); background: rgba(111,165,255,0.1); color: #8fb4ff; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }
    .status-roll-save-result { margin-top: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; padding: 8px 10px; border-radius: 8px; }
    .status-roll-save-result[data-outcome="pass"] { color: #4ade80; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.35); }
    .status-roll-save-result[data-outcome="fail"] { color: #ff9f6b; background: rgba(255,159,107,0.1); border: 1px solid rgba(255,159,107,0.35); }

    /* ── Rest widget (Short Rest / Dig Deep / Full Rest stack) ────────── */
    .chud-rest-widget { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
    .chud-rest-stack-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(248,250,252,0.85); cursor: pointer; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
    .chud-rest-stack-btn:active { transform: scale(0.98); }
    .chud-rest-stack-btn.digdeep { border-color: rgba(255,159,107,0.4); color: #ff9f6b; background: rgba(255,159,107,0.08); justify-content: center; }
    .chud-rest-stack-btn.fullrest { border-color: rgba(111,165,255,0.4); color: #8fb4ff; background: rgba(111,165,255,0.08); justify-content: center; text-align: center; }
    .chud-rest-trigger-label { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
    .chud-rest-stack-btn .chud-tally-marks { color: rgba(15,246,255,0.85); }

    /* ── Persistent Rest Banner (top of HUD, survives until cleared) ──── */
    .chud-rest-banner { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; margin-bottom: 10px; border-radius: 10px; border: 1px solid rgba(255,159,107,0.4); background: rgba(255,159,107,0.1); color: #ffd3b8; }
    .chud-rest-banner-text { font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
    .chud-rest-banner-clear { flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; }

    /* ── Combat Panel ──────────────────────────────────────────────── */
    .chud-combat { margin-top: 4px; }
    .chud-combat-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); padding: 6px 0 8px; cursor: pointer; color: rgba(248,250,252,0.65); font-size: 13px; font-family: var(--font-display, inherit); font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
    .chud-combat.open .chud-combat-toggle { color: rgba(248,250,252,0.9); border-bottom-color: rgba(255,255,255,0.18); }
    .chud-combat-chevron { font-size: 9px; opacity: 0.7; }
    .chud-combat-body { display: none; padding: 8px 0 0; }
    .chud-combat-body.open { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
    .combat-body-row { display: flex; gap: 8px; align-items: stretch; }
    .combat-chip-wrap { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
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
  // Reaction Tokens and the action/reaction Queue have been removed (player
  // side no longer tracks them here). Chip Sync is preserved below.
  const chipWrap = document.createElement('div')
  chipWrap.className = 'combat-chip-wrap'
  const chipBtn = document.createElement('button')
  chipBtn.className = 'combat-chip-toggle'
  chipBtn.setAttribute('data-touch-blocker-ignore', '')
  chipWrap.appendChild(chipBtn)

  const chipSection = document.createElement('div')
  chipSection.className = 'chud-hp-queue-section'
  chipSection.appendChild(chipWrap)

  const refresh = () => {
    const state = readCombat()
    const desynced = !!state.chipDesynced
    chipBtn.innerHTML = desynced ? 'Chip<br>Desynced' : 'Chip<br>Synced'
    chipBtn.dataset.desynced = desynced ? '1' : '0'
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
  window.addEventListener('storage', (ev) => { if (ev.key === COMBAT_KEY) refresh() })
  return { chipSection, shortRestFlag }
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
  const newRow = () => ({ id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', effect: '', roll: 0, direction: 'in' })
  const APPROACH_LABELS = [
    ['force', 'Force'], ['finesse', 'Finesse'], ['guts', 'Guts'],
    ['logic', 'Logic'], ['show', 'Show'], ['tell', 'Tell'],
  ]
  const readApproachState = () => {
    try {
      const s = JSON.parse(localStorage.getItem('chud.state.v1') || '{}')
      const approach = s?.approach && typeof s.approach === 'object' ? s.approach : {}
      const dieSize = Number(s?.approachDieSize) || 8
      return { approach, dieSize }
    } catch { return { approach: {}, dieSize: 8 } }
  }
  // Mirrors domain/approachDice.ts: roll each die once, explode once (one
  // extra die, no re-chaining) when a die lands on its max face.
  const rollApproachExplodeTotal = (count, dieSize) => {
    let total = 0
    for (let i = 0; i < Math.max(0, count); i++) {
      const roll = 1 + Math.floor(Math.random() * dieSize)
      total += roll
      if (roll === dieSize) {
        total += 1 + Math.floor(Math.random() * dieSize)
      }
    }
    return total
  }
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
        direction: row?.direction === 'out' ? 'out' : 'in',
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
  header.innerHTML = '<span class="col-dir">Dir</span><span class="col-name">Name</span><span class="col-effect">Effect</span><span class="col-value">Set Roll</span><span class="col-clear">Clear</span>'
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

  // Opens a Save/Decay modal for the given row. The modal stays open until
  // the user dismisses it via the X button — it never auto-closes.
  const openSaveModal = (row, persist, renderRows) => {
    const overlay = document.createElement('div')
    overlay.className = 'status-roll-save-overlay'

    const modal = document.createElement('div')
    modal.className = 'status-roll-save-modal'

    const closeBtn = document.createElement('button')
    closeBtn.className = 'status-roll-save-modal-close'
    closeBtn.textContent = 'X'
    closeBtn.setAttribute('data-touch-blocker-ignore', '')
    closeBtn.addEventListener('click', () => overlay.remove())

    const title = document.createElement('div')
    title.className = 'status-roll-save-modal-title'
    title.textContent = 'Save / Decay'

    const name = document.createElement('div')
    name.className = 'status-roll-save-modal-name'
    name.textContent = row.name || 'Unnamed Effect'

    const target = document.createElement('div')
    target.className = 'status-roll-save-modal-target'
    target.textContent = `Set Roll: ${row.roll}`

    const controls = document.createElement('div')
    controls.className = 'status-roll-save-modal-controls'

    const select = document.createElement('select')
    select.className = 'status-roll-save-modal-select'
    select.setAttribute('data-touch-blocker-ignore', '')
    APPROACH_LABELS.forEach(([key, label]) => {
      const opt = document.createElement('option')
      opt.value = key
      opt.textContent = label
      select.appendChild(opt)
    })

    const rollBtn = document.createElement('button')
    rollBtn.className = 'status-roll-save-btn'
    rollBtn.textContent = 'Roll Save'
    rollBtn.setAttribute('data-touch-blocker-ignore', '')

    const result = document.createElement('div')
    result.className = 'status-roll-save-result'
    result.style.display = 'none'

    controls.appendChild(select)
    controls.appendChild(rollBtn)

    rollBtn.addEventListener('click', () => {
      const { approach, dieSize } = readApproachState()
      const rating = Number(approach?.[select.value]) || 0
      const total = rollApproachExplodeTotal(rating, dieSize)
      const atRollTime = row.roll
      result.style.display = 'block'
      if (total >= atRollTime) {
        result.setAttribute('data-outcome', 'pass')
        result.textContent = `SAVED — rolled ${total} vs ${atRollTime}`
      } else {
        const margin = atRollTime - total
        row.roll = Math.max(0, atRollTime - margin)
        persist()
        target.textContent = `Set Roll: ${row.roll}`
        result.setAttribute('data-outcome', 'fail')
        result.textContent = `DECAYED -${margin} — rolled ${total} vs ${atRollTime}, now ${row.roll}`
        renderRows()
      }
    })

    modal.appendChild(closeBtn)
    modal.appendChild(title)
    modal.appendChild(name)
    modal.appendChild(target)
    modal.appendChild(controls)
    modal.appendChild(result)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)
  }

  const renderRows = () => {
    rowsWrap.innerHTML = ''
    rows.forEach((row, idx) => {
      const rowEl = document.createElement('div')
      rowEl.className = 'status-roll-row'

      const dirBtn = document.createElement('button')
      dirBtn.className = 'status-roll-direction'
      dirBtn.setAttribute('data-touch-blocker-ignore', '')
      const renderDir = () => {
        dirBtn.setAttribute('data-dir', row.direction)
        dirBtn.textContent = row.direction === 'out' ? 'TRGT' : 'YOU'
        dirBtn.title = row.direction === 'out' ? 'Applied by you to a Target' : 'Applied to You (long-press for Save/Decay)'
      }
      renderDir()
      // Quick tap toggles YOU/TRGT; a long press (on a YOU row) opens the
      // Save/Decay modal instead, so the page never jumps/reflows inline.
      let dirHoldTimer = null
      let dirLongPressed = false
      const DIR_HOLD_MS = 500
      const clearDirHold = () => {
        if (dirHoldTimer) { clearTimeout(dirHoldTimer); dirHoldTimer = null }
        dirBtn.removeAttribute('data-holding')
      }
      dirBtn.addEventListener('pointerdown', (ev) => {
        if (ev.button === 2) return
        dirLongPressed = false
        clearDirHold()
        dirHoldTimer = setTimeout(() => {
          dirLongPressed = true
          clearDirHold()
          if (row.direction === 'in') {
            openSaveModal(row, persist, renderRows)
          }
        }, DIR_HOLD_MS)
        dirBtn.setAttribute('data-holding', '1')
      })
      dirBtn.addEventListener('pointerup', () => {
        clearDirHold()
        if (!dirLongPressed) {
          row.direction = row.direction === 'out' ? 'in' : 'out'
          renderDir()
          persist()
          renderRows()
        }
        dirLongPressed = false
      })
      ;['pointerleave', 'pointercancel'].forEach((evt) => {
        dirBtn.addEventListener(evt, () => { clearDirHold(); dirLongPressed = false })
      })

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

      const mainRow = document.createElement('div')
      mainRow.className = 'status-roll-row-main'
      mainRow.appendChild(dirBtn)
      mainRow.appendChild(nameWrap)
      mainRow.appendChild(effectInput)
      mainRow.appendChild(valueWrap)
      mainRow.appendChild(clearBtn)

      rowEl.appendChild(mainRow)
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

function buildRestWidget() {
  const CHUD_STATE_KEY = 'chud.state.v1'
  const REST_BANNER_KEY = 'chud.restBanner'
  const APPROACH_FIELDS = ['force', 'finesse', 'guts', 'logic', 'show', 'tell']

  const readTally = () => {
    try { const s = JSON.parse(localStorage.getItem(CHUD_STATE_KEY) || '{}'); const v = s.shortRestTally; return typeof v === 'number' ? v : 0 } catch { return 0 }
  }
  const writeTally = (value) => {
    try { const s = JSON.parse(localStorage.getItem(CHUD_STATE_KEY) || '{}'); s.shortRestTally = value; localStorage.setItem(CHUD_STATE_KEY, JSON.stringify(s)) } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: CHUD_STATE_KEY, newValue: localStorage.getItem(CHUD_STATE_KEY) }))
  }
  // Full Rest restores the entire Approach Overload pool — mirrors
  // domain/approachDice.ts's fullRestOverload() (resets spent count to 0
  // for every Approach field).
  const writeFullRest = () => {
    try {
      const s = JSON.parse(localStorage.getItem(CHUD_STATE_KEY) || '{}')
      const resetSpent = {}
      APPROACH_FIELDS.forEach((f) => { resetSpent[f] = 0 })
      s.approachOverloadSpent = resetSpent
      localStorage.setItem(CHUD_STATE_KEY, JSON.stringify(s))
    } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: CHUD_STATE_KEY, newValue: localStorage.getItem(CHUD_STATE_KEY) }))
  }
  const readBanner = () => {
    try { return JSON.parse(localStorage.getItem(REST_BANNER_KEY) || 'null') } catch { return null }
  }
  const writeBanner = (data) => {
    try {
      if (data) localStorage.setItem(REST_BANNER_KEY, JSON.stringify(data))
      else localStorage.removeItem(REST_BANNER_KEY)
    } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: REST_BANNER_KEY, newValue: data ? JSON.stringify(data) : null }))
  }
  const makeTallyGroupSVG = (n) => {
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.classList.add('chud-tally-group')
    svg.setAttribute('width', '26'); svg.setAttribute('height', '20'); svg.setAttribute('viewBox', '0 0 26 20')
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

  // ── Stacked action buttons (bottom of HUD) ──────────────────────────────
  const wrap = document.createElement('div')
  wrap.className = 'chud-rest-widget'

  const shortBtn = document.createElement('button')
  shortBtn.className = 'chud-rest-stack-btn short'
  shortBtn.setAttribute('data-touch-blocker-ignore', '')
  const shortLabel = document.createElement('span')
  shortLabel.className = 'chud-rest-trigger-label'
  shortLabel.textContent = 'Short Rest'
  const marksWrap = document.createElement('div')
  marksWrap.className = 'chud-tally-marks'
  shortBtn.appendChild(shortLabel)
  shortBtn.appendChild(marksWrap)

  const digBtn = document.createElement('button')
  digBtn.className = 'chud-rest-stack-btn digdeep'
  digBtn.textContent = 'Dig Deep'
  digBtn.setAttribute('data-touch-blocker-ignore', '')

  const fullBtn = document.createElement('button')
  fullBtn.className = 'chud-rest-stack-btn fullrest'
  fullBtn.textContent = 'Full Rest (restore Overload dice)'
  fullBtn.setAttribute('data-touch-blocker-ignore', '')

  wrap.appendChild(shortBtn)
  wrap.appendChild(digBtn)
  wrap.appendChild(fullBtn)

  const renderMarks = () => {
    const count = Math.max(0, Math.min(10, readTally()))
    marksWrap.innerHTML = ''
    marksWrap.appendChild(makeTallyGroupSVG(Math.min(5, count)))
    marksWrap.appendChild(makeTallyGroupSVG(Math.max(0, Math.min(5, count - 5))))
  }
  renderMarks()

  shortBtn.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const next = readTally() >= 10 ? 0 : readTally() + 1
    writeTally(next)
    renderMarks()
  })

  // ── Persistent banner (top of HUD; survives until cleared/overwritten) ──
  const banner = document.createElement('div')
  banner.className = 'chud-rest-banner'
  banner.style.display = 'none'
  const bannerText = document.createElement('span')
  bannerText.className = 'chud-rest-banner-text'
  const bannerClear = document.createElement('button')
  bannerClear.className = 'chud-rest-banner-clear'
  bannerClear.textContent = '✕'
  bannerClear.setAttribute('data-touch-blocker-ignore', '')
  banner.appendChild(bannerText)
  banner.appendChild(bannerClear)

  const renderBanner = () => {
    const data = readBanner()
    if (!data) { banner.style.display = 'none'; return }
    banner.style.display = 'flex'
    bannerText.textContent = `Dig Deep — Lose ${data.lose}, Gain ${data.gain} (rolled ${data.d1}, ${data.d2})`
  }
  renderBanner()
  bannerClear.addEventListener('click', (ev) => { ev.stopPropagation(); writeBanner(null); renderBanner() })

  digBtn.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const d1 = 1 + Math.floor(Math.random() * 4)
    const d2 = 1 + Math.floor(Math.random() * 4)
    const lose = Math.max(d1, d2)
    const gain = Math.min(d1, d2)
    writeBanner({ d1, d2, lose, gain, ts: Date.now() })
    renderBanner()
  })

  fullBtn.addEventListener('click', (ev) => {
    ev.stopPropagation()
    writeFullRest()
  })

  window.addEventListener('storage', (ev) => {
    if (ev.key === CHUD_STATE_KEY) renderMarks()
    if (ev.key === REST_BANNER_KEY) renderBanner()
  })

  return { trigger: wrap, banner }
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
  // Chip Sync control. Combat box (CR/FR) has been removed entirely; CR/FR
  // now render read-only on the standalone AAG page, outside this iframe.
  // Page 2 (including Damage die + Short Rest) also lives on the AAG page.
  // Wallet + Reps now live on the standalone MGR page. Reaction Tokens and
  // the action/reaction Queue have been removed (player side).
  const { chipSection } = buildCombatPanel()
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
  // Chip Sync mounts inside the HP box, directly below the HP bar.
  const hpQueueAnchor = panel.querySelector('#chud-hp-queue-anchor')
  if (hpQueueAnchor) {
    hpQueueAnchor.insertAdjacentElement('afterend', chipSection)
  }

  const refreshAll = () => { gcm.update() }
  refreshAll()

  const restWidget = buildRestWidget()
  panel.insertBefore(restWidget.banner, panel.firstChild)
  panel.appendChild(restWidget.trigger)

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
