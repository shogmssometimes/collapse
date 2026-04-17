// interactive social matrix
import CSGraph from './graph.js';
const _BUILD_TS = '2026-04-10T-v9';
console.log('csmatrix: boot', _BUILD_TS);
// storage smoke test – runs once at startup
try {
	const _probe = '__csmatrix_probe__';
	localStorage.setItem(_probe, '1');
	const _ok = localStorage.getItem(_probe) === '1';
	localStorage.removeItem(_probe);
	console.log('csmatrix: localStorage writable:', _ok);
	const _saved = localStorage.getItem('csmatrix.graph');
	console.log('csmatrix: stored graph on load:', _saved ? JSON.parse(_saved).nodes?.length + ' nodes' : 'EMPTY');
} catch(e) { console.error('csmatrix: localStorage error', e); }
let svg = document.getElementById('matrix-svg');
console.log('csmatrix: svg element', !!svg, svg ? `viewbox:${svg.getAttribute('viewBox')}` : 'no-svg');
if (!svg) {
	try {
		const wrap = document.getElementById('matrix-canvas-wrap') || document.body;
		const created = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		created.setAttribute('id', 'matrix-svg');
		created.setAttribute('width', '100%');
		created.setAttribute('viewBox', '0 0 1000 1000');
		created.setAttribute('preserveAspectRatio', 'xMidYMid meet');
		created.style.display = 'block';
		wrap.appendChild(created);
		svg = created;
		console.log('csmatrix: created fallback svg element');
	} catch (err) { console.warn('csmatrix: could not create fallback svg', err); }
}
let graph;
try {
	graph = new CSGraph(svg);
	console.log('csmatrix: graph created');
	if (typeof window !== 'undefined') { window.graph = graph; window.svg = svg; }
} catch (err) {
	console.error('csmatrix: graph creation failed', err);
}
const hostOrigin = (() => {
	try {
		const origin = window.location.origin;
		return origin && origin !== 'null' ? origin : '*';
	} catch (err) { return '*'; }
})();
const hasHostShell = (() => {
	try { return window.parent && window.parent !== window; }
	catch (err) { return false; }
})();
try {
	if (hasHostShell && document && document.body) {
		document.body.classList.add('hosted-toolbar');
	}
} catch (err) { /* ignore */ }
// graph.globalMeters will be set after globalMeters is declared (below)
// persist changes to localStorage
// global meters (not node dependent)
const DEFAULT_NODE_COLOR = '#f0764b';
const sanitizeHexColor = (value) => {
	if (!value && value !== 0) return null;
	const trimmed = `${value}`.trim();
	if (!trimmed) return null;
	const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
	if (/^[0-9a-fA-F]{6}$/.test(hex)) { return `#${hex.toLowerCase()}`; }
	if (/^[0-9a-fA-F]{3}$/.test(hex)) { return `#${hex.split('').map((ch)=>`${ch}${ch}`).join('').toLowerCase()}`; }
	return null;
};
const getColorOrDefault = (value) => sanitizeHexColor(value) || DEFAULT_NODE_COLOR;
// Returns the color to actually display — matches the graph.js SVG rendering fallback
const getNodeDisplayColor = (n) => {
	if (n && sanitizeHexColor(n.color)) return sanitizeHexColor(n.color);
	try { return getComputedStyle(document.documentElement).getPropertyValue('--accent-influence').trim() || '#63ffb1'; } catch(e) { return '#63ffb1'; }
};
const addAlpha = (hex, alpha) => {
	const norm = sanitizeHexColor(hex);
	if (!norm) return null;
	// alpha as two hex chars (e.g., 'cc' for ~80%)
	return `${norm}${alpha}`;
};
const applySliderColors = (card, color) => {
	const strong = addAlpha(color, 'cc') || 'rgba(240,118,75,0.8)';
	const weak = addAlpha(color, '59') || 'rgba(240,118,75,0.35)';
	card.style.setProperty('--slider-color-strong', strong);
	card.style.setProperty('--slider-color-weak', weak);
};
// Shorten a name by dropping interior vowels (keeps first-letter vowels intact)
const abbreviateName = (name) => {
	if (!name) return name;
	if (name.length <= 8) return name;
	return name[0] + name.slice(1).replace(/[aeiouAEIOU]/g, '');
};

let globalMeters = { collapse: 0, influence: 0, record: 0, grit: 0 };
function persistGraph() {
	try {
		// Serialize graph.nodes directly — never depend on graph.toJSON() so cached
		// old versions of graph.js can't silently drop fields like notes or color.
		const nodes = (graph.nodes || []).map(n => ({
			id: n.id,
			name: n.name || '',
			gx: typeof n.gx === 'number' ? n.gx : 0,
			gy: typeof n.gy === 'number' ? n.gy : 0,
			color: n.color || '',
			notes: n.notes || '',
		}));
		const json = { nodes, edges: [], meta: { globalMeters } };
		localStorage.setItem('csmatrix.graph', JSON.stringify(json));
		console.log('csmatrix: saved', nodes.map(n => `${n.id}(color:${n.color},notes:${n.notes?.length||0}ch)`).join(' | '));
	} catch (err) { console.error('csmatrix: persistGraph failed', err); }
}
// graph.onChange is wired AFTER loadSample() so early renders don't wipe localStorage
// sync wrapper height to the rendered svg height to avoid vertical letterbox padding
function getDynamicGraphHeight() {
	const viewport = typeof window !== 'undefined' ? window.innerHeight : 720;
	const header = document.querySelector('header');
	const headerH = header ? header.offsetHeight : 0;
	let reserved = headerH + 40;
	if (typeof document !== 'undefined' && document.body.classList.contains('nodes-open')) {
		const nodeSection = document.getElementById('node-list-section');
		const drawer = nodeSection && nodeSection.offsetHeight ? nodeSection.offsetHeight + 16 : Math.min(420, viewport * 0.4);
		reserved += drawer;
	}
	return Math.max(320, viewport - reserved);
}
function syncCanvasHeight() {
	try {
		const svgEl = document.getElementById('matrix-svg');
		const wrap = document.getElementById('matrix-canvas-wrap');
		if (!svgEl || !wrap) return;
		const targetHeight = getDynamicGraphHeight();
		svgEl.style.height = `${targetHeight}px`;
		wrap.style.height = `${targetHeight}px`;
		wrap.style.minHeight = `${targetHeight}px`;
	} catch (e) { /* ignore */ }
}
if (svg) svg.addEventListener('graph:rendered', () => { syncCanvasHeight(); });
console.log('csmatrix: listeners wired (approx)');
if (!graph) {
	console.error('csmatrix: graph failed to initialize; skipping interactive wiring');
	const errEl = document.getElementById('app-error'); if (errEl) { errEl.classList.remove('hidden'); }
} else {

// HUD click handler removed (meters are changed from Controls only)
function getCssVar(varName, fallback) {
	try {
		const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
		return v || fallback;
	} catch (err) { return fallback; }
}
const meterAccentVarMap = { collapse: '--accent-collapse', influence: '--accent-influence', record: '--accent-record', grit: '--accent-amber' };
const hexToRgba = (hex, alpha = 1) => {
	const norm = sanitizeHexColor(hex);
	if (!norm) return `rgba(255,255,255,${alpha})`;
	const r = parseInt(norm.slice(1,3),16);
	const g = parseInt(norm.slice(3,5),16);
	const b = parseInt(norm.slice(5,7),16);
	return `rgba(${r},${g},${b},${alpha})`;
};
function hslToHex(hsl) {
	try {
		// parse hsl(h,s%,l%)
		const m = hsl.match(/hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/i);
		if (!m) return getCssVar('--text', '#e8eef3');
		const h = Number(m[1]) / 360; const s = Number(m[2]) / 100; const l = Number(m[3]) / 100;
		function hue2rgb(p, q, t) {
			if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p;
		}
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
		const r = Math.round(hue2rgb(p, q, h + 1/3) * 255); const g = Math.round(hue2rgb(p, q, h) * 255); const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
		const toHex = (x) => ('0' + x.toString(16)).slice(-2);
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	} catch (err) { return getCssVar('--text', '#e8eef3'); }
}
// wire controls
function openNewNodeMetersPopup(onConfirm) {
  const existing = document.getElementById('new-node-meters-overlay');
  if (existing) { existing.remove(); return; }
  const globalData = loadFactionMeters();
  const g = {};
  FACTION_METER_FIELDS.forEach(({ key }) => { g[key] = typeof globalData[key] === 'number' ? Math.max(0, globalData[key]) : 0; });

  const live = { trust: 0, distrust: 0, carteBlanche: 0, surveillance: 0 };

  const clamp6 = (v) => Math.max(-6, Math.min(6, v));
  const computeResult = () => ({
    gx: clamp6((live.trust + g.trust) - (live.distrust + g.distrust)),
    gy: clamp6((live.carteBlanche + g.carteBlanche) - (live.surveillance + g.surveillance)),
  });

  const overlay = document.createElement('div');
  overlay.id = 'new-node-meters-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;padding:24px;touch-action:none;';

  const card = document.createElement('div');
  card.style.cssText = 'background:#0d1117;border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:22px 20px 20px;width:min(400px,100%);display:flex;flex-direction:column;gap:18px;box-shadow:0 20px 60px rgba(0,0,0,0.7);max-height:90vh;overflow-y:auto;';


	const titleRow = document.createElement('div');
	titleRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
	const titleEl = document.createElement('div');
	titleEl.style.cssText = 'font-size:0.7rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-weight:600;';
	titleEl.textContent = 'New Contact — Initial Meters';
	const subtitleEl = document.createElement('div');
	subtitleEl.style.cssText = 'font-size:0.72rem;color:rgba(255,255,255,0.3);';
	subtitleEl.textContent = 'Global meter values will be added to give final position.';
	titleRow.appendChild(titleEl);
	titleRow.appendChild(subtitleEl);
	card.appendChild(titleRow);

	// Name field
	const nameRow = document.createElement('div');
	nameRow.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin:10px 0 2px 0;';
	const nameLabel = document.createElement('label');
	nameLabel.textContent = 'Name (optional)';
	nameLabel.style.cssText = 'font-size:0.82rem;color:rgba(255,255,255,0.55);margin-bottom:2px;letter-spacing:0.01em;';
	const nameInput = document.createElement('input');
	nameInput.type = 'text';
	nameInput.placeholder = 'New Node';
	nameInput.style.cssText = 'padding:7px 12px;border-radius:7px;border:1px solid rgba(255,255,255,0.13);background:#181c22;color:#e8eef3;font-size:1rem;outline:none;transition:border 0.15s;width:100%;';
	nameInput.autocomplete = 'off';
	nameRow.appendChild(nameLabel);
	nameRow.appendChild(nameInput);
	card.appendChild(nameRow);

  const STEPS = 7; const MIN = 0; const MAX = 6;

  const makeSlider = ({ key, label }) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:0.82rem;color:rgba(255,255,255,0.8);font-weight:500;letter-spacing:0.04em;';
    lbl.textContent = label;
    const valDisplay = document.createElement('span');
    valDisplay.style.cssText = 'font-size:1rem;font-weight:700;font-variant-numeric:tabular-nums;min-width:28px;text-align:right;transition:color 0.15s;';
    const updateValColor = (v) => { valDisplay.style.color = v > 0 ? '#6ac7ff' : 'rgba(255,255,255,0.5)'; };
    valDisplay.textContent = '0';
    updateValColor(0);
    header.appendChild(lbl); header.appendChild(valDisplay);
    wrap.appendChild(header);

    const trackWrap = document.createElement('div');
    trackWrap.style.cssText = 'position:relative;height:32px;user-select:none;-webkit-user-select:none;touch-action:none;cursor:pointer;';

    const line = document.createElement('div');
    line.style.cssText = 'position:absolute;top:50%;left:0;right:0;height:2px;background:rgba(255,255,255,0.1);transform:translateY(-50%);border-radius:1px;';
    trackWrap.appendChild(line);

    for (let i = 0; i < STEPS; i++) {
      const v = MIN + i;
      const pct = i / (STEPS - 1) * 100;
      const tick = document.createElement('div');
      const isLeft = v === 0; const isMajor = v % 3 === 0;
      tick.style.cssText = `position:absolute;top:50%;left:${pct}%;transform:translate(-50%,-50%);width:${isLeft ? 3 : isMajor ? 2 : 1}px;height:${isLeft ? 14 : isMajor ? 10 : 6}px;background:${isLeft ? 'rgba(255,255,255,0.5)' : isMajor ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'};border-radius:1px;pointer-events:none;`;
      trackWrap.appendChild(tick);
    }

    const thumb = document.createElement('div');
    thumb.style.cssText = 'position:absolute;top:50%;left:0%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#f5fbff;box-shadow:0 0 8px rgba(255,255,255,0.4);pointer-events:none;';
    trackWrap.appendChild(thumb);

    const hints = document.createElement('div');
    hints.style.cssText = 'display:flex;justify-content:space-between;';
    [0, 3, 6].forEach((v, i) => {
      const h = document.createElement('span');
      h.style.cssText = 'font-size:0.6rem;color:rgba(255,255,255,0.25);font-variant-numeric:tabular-nums;';
      h.textContent = `${v}`;
      if (i === 1) h.style.textAlign = 'center';
      if (i === 2) h.style.textAlign = 'right';
      hints.appendChild(h);
    });

    wrap.appendChild(trackWrap);
    wrap.appendChild(hints);

    const getValFromX = (clientX) => {
      const rect = trackWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(MIN + pct * (MAX - MIN));
    };
    const setVal = (v) => {
      live[key] = v;
      const pct = (v - MIN) / (MAX - MIN) * 100;
      thumb.style.left = `${pct}%`;
      valDisplay.textContent = `${v}`;
      updateValColor(v);
      refreshResult();
    };

    trackWrap.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      trackWrap.setPointerCapture(e.pointerId);
      setVal(getValFromX(e.clientX));
      const onMove = (ev) => setVal(getValFromX(ev.clientX));
      const onUp = () => { trackWrap.removeEventListener('pointermove', onMove); trackWrap.removeEventListener('pointerup', onUp); };
      trackWrap.addEventListener('pointermove', onMove);
      trackWrap.addEventListener('pointerup', onUp);
    });

    return wrap;
  };


	// Mini matrix preview SVG
	const miniMatrixWrap = document.createElement('div');
	miniMatrixWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:8px;';
	const miniLabel = document.createElement('div');
	miniLabel.textContent = 'Matrix Preview';
	miniLabel.style.cssText = 'font-size:0.68rem;color:rgba(255,255,255,0.32);letter-spacing:0.12em;margin-bottom:2px;';
	miniMatrixWrap.appendChild(miniLabel);
	const size = 120, pad = 18, gridMin = -6, gridMax = 6, steps = gridMax - gridMin;
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
	svg.style.background = 'rgba(255,255,255,0.01)';
	svg.style.borderRadius = '8px';
	svg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
	// Draw grid lines
	for (let i = gridMin; i <= gridMax; i++) {
		const x = pad + ((i - gridMin) / steps) * (size - 2 * pad);
		const y = pad + ((gridMax - i) / steps) * (size - 2 * pad);
		// vertical
		const vline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		vline.setAttribute('x1', x); vline.setAttribute('x2', x);
		vline.setAttribute('y1', pad); vline.setAttribute('y2', size - pad);
		vline.setAttribute('stroke', 'rgba(255,255,255,0.10)');
		svg.appendChild(vline);
		// horizontal
		const hline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		hline.setAttribute('x1', pad); hline.setAttribute('x2', size - pad);
		hline.setAttribute('y1', y); hline.setAttribute('y2', y);
		hline.setAttribute('stroke', 'rgba(255,255,255,0.10)');
		svg.appendChild(hline);
	}
	// Axis labels
	const axisFont = '10px sans-serif';
	const mkText = (txt, x, y, anchor, color) => {
		const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('fill', color || '#aaa');
		t.setAttribute('font-size', '10px'); t.setAttribute('font-family', 'inherit');
		t.setAttribute('text-anchor', anchor);
		t.textContent = txt;
		return t;
	};
	svg.appendChild(mkText('Trust', pad, size/2+2, 'start', '#6ac7ff'));
	svg.appendChild(mkText('Distrust', size-pad, size/2+2, 'end', '#ffdf7e'));
	svg.appendChild(mkText('Carte Blanche', size/2, pad-4, 'middle', '#6ac7ff'));
	svg.appendChild(mkText('Surveillance', size/2, size-pad+14, 'middle', '#ffdf7e'));
	// Dot for node position
	const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
	dot.setAttribute('r', '8');
	dot.setAttribute('fill', '#fff');
	dot.setAttribute('stroke', '#6ac7ff');
	dot.setAttribute('stroke-width', '2');
	svg.appendChild(dot);
	miniMatrixWrap.appendChild(svg);
	card.appendChild(miniMatrixWrap);

	function updateDot() {
		const { gx, gy } = computeResult();
		// Clamp to grid
		const cx = pad + ((gx - gridMin) / steps) * (size - 2 * pad);
		const cy = pad + ((gridMax - gy) / steps) * (size - 2 * pad);
		dot.setAttribute('cx', cx);
		dot.setAttribute('cy', cy);
		dot.setAttribute('fill', gx === 0 && gy === 0 ? '#fff' : '#6ac7ff');
		dot.setAttribute('stroke', gx === 0 && gy === 0 ? '#bbb' : '#6ac7ff');
	}

	// Initial dot
	updateDot();

	// Sliders
	FACTION_METER_FIELDS.forEach(f => card.appendChild(makeSlider(f)));

	// Patch refreshResult to also update dot
	const origRefresh = refreshResult;
	refreshResult = function() { origRefresh(); updateDot(); };

  // Result preview
  const resultRow = document.createElement('div');
  resultRow.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:12px 14px;background:rgba(255,255,255,0.04);border-radius:8px;border:1px solid rgba(255,255,255,0.08);';
  const resultLabel = document.createElement('div');
  resultLabel.style.cssText = 'font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-weight:600;';
  resultLabel.textContent = 'Final Position (node + global)';
  const resultVals = document.createElement('div');
  resultVals.style.cssText = 'display:flex;gap:24px;';

  const makeResultCell = (axisLabel) => {
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:0.68rem;color:rgba(255,255,255,0.3);';
    lbl.textContent = axisLabel;
    const val = document.createElement('span');
    val.style.cssText = 'font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums;transition:color 0.12s;';
    cell.appendChild(lbl); cell.appendChild(val);
    return { cell, val };
  };

  const xCell = makeResultCell('Trust / Distrust');
  const yCell = makeResultCell('Carte Blanche / Surveillance');
  resultVals.appendChild(xCell.cell);
  resultVals.appendChild(yCell.cell);
  resultRow.appendChild(resultLabel);
  resultRow.appendChild(resultVals);
  card.appendChild(resultRow);

  const colorForVal = (v) => v > 0 ? '#6ac7ff' : v < 0 ? '#ffdf7e' : 'rgba(255,255,255,0.5)';
  const fmtVal = (v) => v > 0 ? `+${v}` : `${v}`;

  function refreshResult() {
    const r = computeResult();
    xCell.val.textContent = fmtVal(r.gx);
    xCell.val.style.color = colorForVal(r.gx);
    yCell.val.textContent = fmtVal(r.gy);
    yCell.val.style.color = colorForVal(r.gy);
  }
  refreshResult();

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:2px;';
  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancel';
  btnCancel.style.cssText = 'padding:8px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:rgba(255,255,255,0.45);cursor:pointer;font-size:0.85rem;';
  btnCancel.addEventListener('click', () => overlay.remove());
  const btnAdd = document.createElement('button');
  btnAdd.textContent = 'Add Contact';
  btnAdd.style.cssText = 'padding:8px 22px;border-radius:8px;border:1px solid rgba(99,255,177,0.4);background:rgba(99,255,177,0.1);color:#63ffb1;cursor:pointer;font-size:0.85rem;font-weight:600;';
	btnAdd.addEventListener('click', () => {
		overlay.remove();
		const name = nameInput.value && nameInput.value.trim() ? nameInput.value.trim() : undefined;
		onConfirm(computeResult(), name);
	});
  btnRow.appendChild(btnCancel);
  btnRow.appendChild(btnAdd);
  card.appendChild(btnRow);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) overlay.remove(); });
}

document.getElementById('btn-add-node').addEventListener('click', () => {
	openNewNodeMetersPopup(({ gx, gy }, name) => {
		const defaultColor = getColorOrDefault(graph._nextColor ? graph._nextColor() : getCssVar('--accent-influence', '#4caf50'));
		const node = graph.addNode({ name: name || 'New Node', gx, gy, color: defaultColor });
		graph.selectNode(node);
		try { persistGraph(); } catch (e) {}
		updateNodeList();
	});
});
document.getElementById('btn-delete')?.addEventListener('click', () => {
	if (graph.selected.node) {
		console.log('Delete Selected clicked for', graph.selected.node.id);
		graph.removeNode(graph.selected.node.id);
		try { persistGraph(); } catch (e) {}
		updateNodeList();
	}
});
document.getElementById('btn-export').addEventListener('click', () => {
	const json = graph.toJSON(); json.meta = { globalMeters };
	const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `csmatrix-${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
document.getElementById('import-file').addEventListener('change', (ev) => {
	const f = ev.target.files[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => {
		try {
			const json = JSON.parse(reader.result);
			graph.fromJSON(json);
			if (json.meta && json.meta.globalMeters) { globalMeters = json.meta.globalMeters; updateGlobalMetersUI(); updateControlMeterBars(); }
			persistGraph();
		} catch (err) { alert('Invalid JSON file'); }
	};
	reader.readAsText(f);
});
document.getElementById('btn-reset').addEventListener('click', () => { localStorage.removeItem('csmatrix.graph'); loadSample(); });

// Node edit panel wiring
// Node panel overlay removed; per-card panels are embedded in the node list.
graph.svg.addEventListener('graph:select', (ev) => { requestAnimationFrame(() => { updateEdgePanel(); updateNodeList(); }); });
// Manual double-click detector — browser dblclick is unreliable here because render()
// destroys and recreates all SVG child elements on every single click, so the browser
// can't determine a common ancestor and may silently drop the dblclick event.
let _lastNodeClick = { id: null, time: 0 };
graph.svg.addEventListener('click', (ev) => {
	const t = ev.target;
	const nodeId = (t && t.dataset) ? t.dataset.nodeId : null;
	if (!nodeId) { _lastNodeClick = { id: null, time: 0 }; return; }
	const now = Date.now();
	if (nodeId === _lastNodeClick.id && now - _lastNodeClick.time < 400) {
		_lastNodeClick = { id: null, time: 0 };
		const n = graph.nodes.find(x => x.id === nodeId);
		if (!n) return;
		const modal = document.getElementById('node-detail-modal');
		if (!modal) return;
		const nodeColor = getNodeDisplayColor(n);
		modal.querySelector('.node-modal-swatch').style.backgroundColor = nodeColor;
		const modalInner = modal.querySelector('.node-modal');
		if (modalInner) modalInner.style.setProperty('--modal-accent', nodeColor);
		modal.querySelector('.node-modal-name').textContent = n.name || '(no name)';
		const ql = getQuadrantLabel(n.gx, n.gy);
		const qBadge = modal.querySelector('.node-modal-quadrant');
		qBadge.textContent = ql; qBadge.dataset.quadrant = getQuadrantSlug(ql); qBadge.style.display = ql ? '' : 'none';
		modal.querySelector('.node-modal-coords').textContent = `Matrix: ${n.gx}, ${n.gy}`;
		const notesEl = modal.querySelector('.node-modal-notes');
		if (notesEl) { notesEl.textContent = n.notes || ''; notesEl.style.display = n.notes ? '' : 'none'; }
		modal.hidden = false;
	} else {
		_lastNodeClick = { id: nodeId, time: now };
	}
});
	// per-card save handlers are created inline when building node cards.

// live input handlers for sliders and color
// per-card live input handlers are created when panels are built.

// Global meters buttons (wired regardless of graph presence)
function updateGlobalMetersUI() {
	const elCollapse = document.getElementById('global-meter-collapse-value'); if (elCollapse) elCollapse.textContent = globalMeters.collapse || 0;
	const elInfluence = document.getElementById('global-meter-influence-value'); if (elInfluence) elInfluence.textContent = globalMeters.influence || 0;
	const elRecord = document.getElementById('global-meter-record-value'); if (elRecord) elRecord.textContent = globalMeters.record || 0;
	['collapse','influence','record','grit'].forEach(syncMeterRowVisual);
}
const changeGlobalMeter = (name, delta) => {
	globalMeters[name] = Math.max(0, Math.min(6, (globalMeters[name] || 0) + delta));
	updateGlobalMetersUI();
	persistGraph();
	updateControlMeterBars();
};
function syncMeterRowVisual(name) {
	const row = document.querySelector(`.meter-row[data-meter-tap="${name}"]`);
	if (!row) return;
	const value = Math.max(0, Math.min(6, globalMeters[name] || 0));
	const ratio = value / 6;
	const accentVar = meterAccentVarMap[name] || '--accent-amber';
	const accent = getCssVar(accentVar, '#fbbf24');
	row.style.setProperty('--meter-scale', ratio.toFixed(3));
	row.style.setProperty('--meter-accent', accent);
	row.style.setProperty('--meter-glow', hexToRgba(accent, 0.45));
	row.style.setProperty('--meter-ambient', hexToRgba(accent, 0.18 + ratio * 0.25));
	const glowSize = 16 + ratio * 28;
	const glowOpacity = 0.28 + ratio * 0.6;
	row.style.setProperty('--meter-glow-size', `${glowSize.toFixed(1)}px`);
	row.style.setProperty('--meter-glow-opacity', glowOpacity.toFixed(3));
	row.dataset.level = `${value}`;
}
const stopNodeCardPropagation = (element) => {
	if (!element) return;
	['mousedown','mouseup','click','dblclick','focus','keydown'].forEach(evt => {
		element.addEventListener(evt, (ev) => ev.stopPropagation());
	});
};
// Update small control meter bars when values change
function updateControlMeterBars() {
	const renderBars = (id, value, colorClass) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.innerHTML = '';
		for (let i=0;i<6;i++) {
			const unit = document.createElement('span'); unit.className = `unit ${i < value ? 'active ' + colorClass : ''}`; el.appendChild(unit);
		}
	};
	renderBars('ctrl-meter-collapse', globalMeters.collapse || 0, 'collapse');
	renderBars('ctrl-meter-influence', globalMeters.influence || 0, 'influence');
	renderBars('ctrl-meter-record', globalMeters.record || 0, 'record');
	renderBars('ctrl-meter-grit', globalMeters.grit || 0, 'grit');
}
function setupMeterTapTargets() {
	const LONG_PRESS_MS = 520;
	const targets = document.querySelectorAll('[data-meter-tap]');
	targets.forEach(target => {
		const meter = target.getAttribute('data-meter-tap');
		if (!meter) return;
		let timer = null;
		let longPress = false;
		let suppressClick = false;
		const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
		const handleIncrement = () => { suppressClick = true; changeGlobalMeter(meter, +1); };
		const handleDecrement = () => { suppressClick = true; changeGlobalMeter(meter, -1); };
		target.addEventListener('pointerdown', (ev) => {
			if (ev.button === 2) return;
			longPress = false;
			suppressClick = false;
			clearTimer();
			timer = setTimeout(() => {
				longPress = true;
				handleDecrement();
			}, LONG_PRESS_MS);
		});
		target.addEventListener('pointerup', (ev) => {
			if (ev.button === 2) return;
			if (timer) clearTimer();
			if (!longPress) { handleIncrement(); }
			longPress = false;
		});
		['pointerleave','pointercancel'].forEach(eventName => {
			target.addEventListener(eventName, () => {
				if (timer) clearTimer();
				longPress = false;
			});
		});
		target.addEventListener('contextmenu', (ev) => {
			ev.preventDefault();
			handleDecrement();
		});
		target.addEventListener('click', (ev) => {
			if (suppressClick) {
				ev.preventDefault();
				ev.stopPropagation();
				suppressClick = false;
			}
		});
	});
}
setupMeterTapTargets();
// wire toggle for showing controls on mobile
// ── Global Meters popup ──────────────────────────────────────────────────────
const GLOBAL_METERS_KEY = 'csmatrix.globalMeters.faction';
const FACTION_METER_FIELDS = [
  { key: 'trust',        label: 'Trust' },
  { key: 'distrust',     label: 'Distrust' },
  { key: 'carteBlanche', label: 'Carte Blanche' },
  { key: 'surveillance', label: 'Surveillance' },
];
function loadFactionMeters() {
  try { const r = localStorage.getItem(GLOBAL_METERS_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function saveFactionMeters(data) {
  try { localStorage.setItem(GLOBAL_METERS_KEY, JSON.stringify(data)); } catch {}
}
function openGlobalMetersPopup() {
  const existing = document.getElementById('global-meters-popup-overlay');
  if (existing) { existing.remove(); return; }
  const data = loadFactionMeters();
  // live values while popup is open
  const live = {};
  FACTION_METER_FIELDS.forEach(({ key }) => { live[key] = typeof data[key] === 'number' ? Math.max(0, data[key]) : 0; });

  const overlay = document.createElement('div');
  overlay.id = 'global-meters-popup-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;padding:24px;touch-action:none;';

  const card = document.createElement('div');
  card.style.cssText = 'background:#0d1117;border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:22px 20px 20px;width:min(380px,100%);display:flex;flex-direction:column;gap:20px;box-shadow:0 20px 60px rgba(0,0,0,0.7);';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:0.7rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-weight:600;';
  title.textContent = 'Global Meters';
  card.appendChild(title);

  const STEPS = 7; // 0 … +6
  const MIN = 0; const MAX = 6;

  const thumbEls = {};

  const makeSlider = ({ key, label }) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    // label + value
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:0.82rem;color:rgba(255,255,255,0.8);font-weight:500;letter-spacing:0.04em;';
    lbl.textContent = label;
    const valDisplay = document.createElement('span');
    valDisplay.style.cssText = 'font-size:1rem;font-weight:700;font-variant-numeric:tabular-nums;min-width:28px;text-align:right;transition:color 0.15s;';
    const updateValColor = (v) => { valDisplay.style.color = v > 0 ? '#6ac7ff' : 'rgba(255,255,255,0.5)'; };
    const initVal = Math.max(0, typeof live[key] === 'number' ? live[key] : 0);
    live[key] = initVal;
    valDisplay.textContent = `${initVal}`;
    updateValColor(initVal);
    header.appendChild(lbl); header.appendChild(valDisplay);
    wrap.appendChild(header);

    // track
    const trackWrap = document.createElement('div');
    trackWrap.style.cssText = 'position:relative;height:32px;user-select:none;-webkit-user-select:none;touch-action:none;cursor:pointer;';

    // background line
    const line = document.createElement('div');
    line.style.cssText = 'position:absolute;top:50%;left:0;right:0;height:2px;background:rgba(255,255,255,0.1);transform:translateY(-50%);border-radius:1px;';
    trackWrap.appendChild(line);

    // tick marks
    for (let i = 0; i < STEPS; i++) {
      const v = MIN + i;
      const pct = i / (STEPS - 1) * 100;
      const tick = document.createElement('div');
      const isLeft = v === 0;
      const isMajor = v % 3 === 0;
      tick.style.cssText = `position:absolute;top:50%;left:${pct}%;transform:translate(-50%,-50%);width:${isLeft ? 3 : isMajor ? 2 : 1}px;height:${isLeft ? 14 : isMajor ? 10 : 6}px;background:${isLeft ? 'rgba(255,255,255,0.5)' : isMajor ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'};border-radius:1px;pointer-events:none;`;
      trackWrap.appendChild(tick);
    }

    // thumb
    const thumb = document.createElement('div');
    const pctInit = (initVal - MIN) / (MAX - MIN) * 100;
    thumb.style.cssText = `position:absolute;top:50%;left:${pctInit}%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#f5fbff;box-shadow:0 0 8px rgba(255,255,255,0.4);pointer-events:none;transition:left 0.05s;`;
    trackWrap.appendChild(thumb);
    thumbEls[key] = thumb;

    // label hints
    const hints = document.createElement('div');
    hints.style.cssText = 'display:flex;justify-content:space-between;';
    [0, 3, 6].forEach((v, i) => {
      const h = document.createElement('span');
      h.style.cssText = 'font-size:0.6rem;color:rgba(255,255,255,0.25);font-variant-numeric:tabular-nums;';
      h.textContent = `${v}`;
      if (i === 1) h.style.textAlign = 'center';
      if (i === 2) h.style.textAlign = 'right';
      hints.appendChild(h);
    });

    wrap.appendChild(trackWrap);
    wrap.appendChild(hints);

    const getValFromX = (clientX) => {
      const rect = trackWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(MIN + pct * (MAX - MIN));
    };
    const setVal = (v) => {
      live[key] = v;
      const pct = (v - MIN) / (MAX - MIN) * 100;
      thumb.style.transition = 'none';
      thumb.style.left = `${pct}%`;
      valDisplay.textContent = `${v}`;
      updateValColor(v);
      // persist immediately
      saveFactionMeters({ ...loadFactionMeters(), [key]: v });
    };

    trackWrap.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      trackWrap.setPointerCapture(e.pointerId);
      setVal(getValFromX(e.clientX));
      const onMove = (ev) => setVal(getValFromX(ev.clientX));
      const onUp = () => { trackWrap.removeEventListener('pointermove', onMove); trackWrap.removeEventListener('pointerup', onUp); };
      trackWrap.addEventListener('pointermove', onMove);
      trackWrap.addEventListener('pointerup', onUp);
    });

    card.appendChild(wrap);
  };

  FACTION_METER_FIELDS.forEach(makeSlider);

  // close button
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;margin-top:2px;';
  const btnClose = document.createElement('button');
  btnClose.textContent = 'Done';
  btnClose.style.cssText = 'padding:8px 22px;border-radius:8px;border:1px solid rgba(99,255,177,0.4);background:rgba(99,255,177,0.1);color:#63ffb1;cursor:pointer;font-size:0.85rem;font-weight:600;';
  btnClose.addEventListener('click', () => overlay.remove());
  btnRow.appendChild(btnClose);
  card.appendChild(btnRow);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) overlay.remove(); });
}
const btnSetGlobalMeters = document.getElementById('btn-set-global-meters');
if (btnSetGlobalMeters) btnSetGlobalMeters.addEventListener('click', openGlobalMetersPopup);

const btnToggleControls = document.getElementById('btn-toggle-controls');
const notifyHostState = () => {
	if (!hasHostShell) return;
	try {
		window.parent.postMessage({
			type: 'collapse-csmatrix-state',
			controlsOpen: document.body.classList.contains('controls-open'),
			nodesOpen: document.body.classList.contains('nodes-open'),
		}, hostOrigin);
	} catch (err) { console.warn('csmatrix: failed to post state to host', err); }
};
function syncControlsToggleState(isOpen) {
	if (!btnToggleControls) return;
	const open = typeof isOpen === 'boolean' ? isOpen : document.body.classList.contains('controls-open');
	btnToggleControls.textContent = open ? 'Hide Controls' : 'Show Controls';
	btnToggleControls.setAttribute('aria-expanded', open ? 'true' : 'false');
	notifyHostState();
}
if (btnToggleControls) {
	btnToggleControls.addEventListener('click', () => {
		const isOpen = document.body.classList.toggle('controls-open');
		syncControlsToggleState(isOpen);
		// Trigger a graph re-render to ensure the canvas resizes and nodes update
		try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {}
		// Update visibility helper for small screens
		updateControlsVisibility();
	});
}
// Maximize graph removed (feature removed per request)
// Maximize graph removed
// hide controls from within the controls panel
const btnHideControls = document.getElementById('btn-hide-controls');
if (btnHideControls) {
	btnHideControls.addEventListener('click', () => {
		document.body.classList.remove('controls-open');
		syncControlsToggleState(false);
		updateControlsVisibility();
	});
}
// When hide controls clicked, ensure the graph updates
if (btnHideControls) {
	btnHideControls.addEventListener('click', () => { try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {} });
}
const btnToggleNodes = document.getElementById('btn-toggle-nodes');
const btnHideNodes = null; // removed — no separate close button in inline drawer
function syncNodeToggleState() {
	if (!btnToggleNodes) return;
	const open = document.body.classList.contains('nodes-open');
	btnToggleNodes.setAttribute('aria-expanded', open ? 'true' : 'false');
	const chevron = btnToggleNodes.querySelector('.nodes-drawer-chevron');
	if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
	notifyHostState();
}
if (btnToggleNodes) {
	btnToggleNodes.addEventListener('click', () => {
		const open = document.body.classList.toggle('nodes-open');
		syncNodeToggleState();
		try { if (graph && typeof graph.render === 'function') graph.render(); } catch (e) {}
		try { syncCanvasHeight(); } catch (e) {}
	});
}
if (btnHideNodes) {
	// no-op: inline drawer has no separate close button
}
syncControlsToggleState();
syncNodeToggleState();
if (hasHostShell) {
	try {
		window.parent.postMessage({ type: 'collapse-csmatrix-ready' }, hostOrigin);
		notifyHostState();
	} catch (err) { /* ignore */ }
	window.addEventListener('message', (event) => {
		if (hostOrigin !== '*' && event.origin !== hostOrigin) return;
		const data = event.data || {};
		if (data.target !== 'csmatrix') return;
		switch (data.action) {
			case 'toggle-controls':
				if (btnToggleControls) btnToggleControls.click();
				break;
			case 'toggle-nodes':
				if (btnToggleNodes) btnToggleNodes.click();
				break;
			case 'request-state':
				notifyHostState();
				break;
			default:
				break;
		}
	});
}

// HUD toggle button: hide/show header meters and controls
const btnToggleHud = document.getElementById('btn-toggle-hud');
if (btnToggleHud) {
	btnToggleHud.setAttribute('aria-pressed', document.body.classList.contains('hud-hidden') ? 'true' : 'false');
	btnToggleHud.addEventListener('click', () => {
		const hidden = document.body.classList.toggle('hud-hidden');
		// set aria-pressed state and update aria-label for screen readers
		btnToggleHud.setAttribute('aria-pressed', hidden ? 'true' : 'false');
		btnToggleHud.setAttribute('aria-label', hidden ? 'Show HUD' : 'Hide HUD');
		// also ensure Controls are hidden when HUD is hidden
		if (hidden) {
			document.body.classList.remove('controls-open');
			document.body.classList.remove('nodes-open');
			try { syncControlsToggleState(false); } catch (e) {}
			syncNodeToggleState();
		}
		// update axis pills for screen readers
		document.querySelectorAll('.axis-pill').forEach(el => { el.setAttribute('aria-hidden', hidden ? 'true' : 'false'); });
		// ensure graph redraw for layout changes
		try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {}
	});
}
	// ensure graph redraw on viewport resizes so canvas fills available space
	window.addEventListener('resize', () => { try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {} });
// Force auto-fit now that the manual toggle has been removed
try {
	if (graph && typeof graph.setAutoMax === 'function') graph.setAutoMax(true);
	document.body.classList.add('graph-auto-max');
} catch (e) { /* ignore */ }
// Helper to sync UI scale classes for posture modes
const applyScaleClass = (mode) => {
	const value = mode || 'normal';
	document.body.classList.remove('ui-scale-compact','ui-scale-normal','ui-scale-spacious');
	document.body.classList.add(value === 'compact' ? 'ui-scale-compact' : (value === 'spacious' ? 'ui-scale-spacious' : 'ui-scale-normal'));
};
// posture toggle: compact UI vs normal (persisted)
const btnPosture = document.getElementById('btn-posture');
function loadPosture() {
	try {
		const p = localStorage.getItem('csmatrix.posture');
		applyScaleClass(p || 'normal');
		if (btnPosture) btnPosture.setAttribute('aria-pressed', document.body.classList.contains('ui-scale-compact') ? 'true' : 'false');
	} catch (e) {}
}
if (btnPosture) {
	btnPosture.addEventListener('click', () => {
		const compact = !document.body.classList.contains('ui-scale-compact');
		const next = compact ? 'compact' : 'normal';
		applyScaleClass(next);
		localStorage.setItem('csmatrix.posture', next);
		btnPosture.setAttribute('aria-pressed', compact ? 'true' : 'false');
	});
}
loadPosture();
// Controls visibility helper: overlay panel only shows when controls-open and HUD is visible
function updateControlsVisibility() {
	const controlsEl = document.getElementById('controls');
	if (!controlsEl) return;
	if (document.body.classList.contains('hud-hidden')) {
		controlsEl.style.setProperty('display', 'none', 'important');
		return;
	}
	if (document.body.classList.contains('controls-open')) {
		controlsEl.style.setProperty('display', 'block', 'important');
	} else {
		controlsEl.style.setProperty('display', 'none', 'important');
	}
}
// Expose helper globally for automated tests & script toggles
try { window.updateControlsVisibility = updateControlsVisibility; } catch(e) {}
window.addEventListener('resize', updateControlsVisibility);
updateControlsVisibility();
// also call syncCanvasHeight on initial load so wrapper matches svg size
try { syncCanvasHeight(); } catch(e) {}
// old overlay cancel button removed — per-card cancel buttons now available

// Edge UI removed - edges are not used for simplified social matrix
function updateEdgePanel() { return; }

// Node list rendering
function getQuadrantLabel(gx, gy) {
	if (gx === 0 || gy === 0) return '';
	if (gx > 0 && gy > 0) return 'Target';
	if (gx < 0 && gy > 0) return 'Valuable Risk';
	if (gx < 0 && gy < 0) return 'Asset';
	return 'Useful Ghost';
}
function getQuadrantSlug(label) {
	return label.toLowerCase().replace(/\s+/g, '-');
}
function updateNodeList() {
	const list = document.getElementById('node-list'); if (!list) return;
	console.log('updateNodeList called, nodes:', graph.nodes.map(n => n.id));
	list.innerHTML = '';
	if (!graph.nodes || graph.nodes.length === 0) {
		const empt = document.createElement('div'); empt.textContent = 'No nodes yet — Add a node with the Add Node button'; empt.style.color='var(--muted)'; list.appendChild(empt);
		return;
	}
	graph.nodes.forEach(n => {
		const card = document.createElement('div'); card.className = 'node-card'; card.tabIndex = 0; card.setAttribute('role','button');
		const header = document.createElement('div'); header.className = 'node-card-head';
		const colorInStorage = sanitizeHexColor(n.color);
		const colorValue = colorInStorage || getNodeDisplayColor(n);
		if (colorInStorage) n.color = colorInStorage; // only normalise format, never overwrite valid color with default
		applySliderColors(card, colorValue);
		const sw = document.createElement('div'); sw.className = 'node-swatch'; sw.style.backgroundColor = colorValue;
		const title = document.createElement('div'); title.textContent = abbreviateName(n.name) || '(no name)'; title.title = n.name || '(no name)'; title.className = 'node-name';
		const quadLabel = getQuadrantLabel(n.gx, n.gy);
		const quadBadge = document.createElement('span'); quadBadge.className = 'node-quadrant'; quadBadge.textContent = quadLabel; quadBadge.dataset.quadrant = getQuadrantSlug(quadLabel); quadBadge.style.display = quadLabel ? '' : 'none';
		const coords = document.createElement('div'); coords.textContent = `Matrix: ${n.gx}, ${n.gy}`; coords.className = 'node-coords';
		const del = document.createElement('button'); del.className = 'delete-node'; del.textContent = '✕'; del.setAttribute('aria-label', `Delete ${n.name || 'node'}`);
		let _delClicks = 0, _delTimer = null;
		del.addEventListener('click', (ev) => {
			ev.stopPropagation();
			_delClicks++;
			if (_delTimer) clearTimeout(_delTimer);
			if (_delClicks >= 3) {
				_delClicks = 0;
				del.textContent = '\u2715';
				graph.removeNode(n.id);
				try { persistGraph(); } catch (e) {}
				updateNodeList();
				return;
			}
			del.textContent = _delClicks === 1 ? '\u2715\u2715' : '\u2715\u2715\u2715';
			_delTimer = setTimeout(() => { _delClicks = 0; del.textContent = '\u2715'; }, 1200);
		});
		const row1 = document.createElement('div'); row1.className = 'node-card-head-row';
		row1.appendChild(sw); row1.appendChild(title); row1.appendChild(del);
		const row2 = document.createElement('div'); row2.className = 'node-card-head-meta'; row2.style.display = quadLabel ? '' : 'none';
		row2.appendChild(quadBadge);
		header.appendChild(row1); header.appendChild(row2);
		card.appendChild(header);
		// Removed stat line under header

		// inline node panel (embedded into the card)
		const panel = document.createElement('div'); panel.className = 'node-panel-inline panel';
		// Name field
		const nameLabel = document.createElement('label'); nameLabel.textContent = 'Name: '; const nameInput = document.createElement('input'); nameInput.value = n.name || ''; nameLabel.appendChild(nameInput); panel.appendChild(nameLabel);
		panel.appendChild(coords);
		stopNodeCardPropagation(nameInput);
		nameInput.addEventListener('input', () => {
			n.name = nameInput.value;
			title.textContent = abbreviateName(n.name) || '(no name)';
			title.title = n.name || '(no name)';
			try { persistGraph(); } catch(e) {}
		});
		// X slider
		const xLabel = document.createElement('label'); xLabel.textContent = 'Trust / Distrust: '; const xInput = document.createElement('input'); xInput.type = 'range'; xInput.min = -6; xInput.max = 6; xInput.step = 1; xInput.value = typeof n.gx === 'number' ? n.gx : 0; const xSpan = document.createElement('span'); xSpan.textContent = xInput.value; xLabel.appendChild(xInput); xLabel.appendChild(xSpan); panel.appendChild(xLabel);
		stopNodeCardPropagation(xInput);
		// Y slider
		const yLabel = document.createElement('label'); yLabel.textContent = 'Carte Blanche / Surveillance: '; const yInput = document.createElement('input'); yInput.type = 'range'; yInput.min = -6; yInput.max = 6; yInput.step = 1; yInput.value = typeof n.gy === 'number' ? n.gy : 0; const ySpan = document.createElement('span'); ySpan.textContent = yInput.value; yLabel.appendChild(yInput); yLabel.appendChild(ySpan); panel.appendChild(yLabel);
		stopNodeCardPropagation(yInput);
		// Color
		const colorLabel = document.createElement('label'); colorLabel.textContent = 'Color Hex: ';
		const colorInput = document.createElement('input');
		colorInput.type = 'text';
		colorInput.inputMode = 'text';
		colorInput.autocomplete = 'off';
		colorInput.spellcheck = false;
		colorInput.maxLength = 7;
		colorInput.placeholder = DEFAULT_NODE_COLOR;
		colorInput.value = colorValue;
		colorLabel.appendChild(colorInput);
		panel.appendChild(colorLabel);
		stopNodeCardPropagation(colorInput);
		// Quick palette
		const palette = document.createElement('div');
		palette.className = 'color-palette';
		const paletteColors = ['#f0764b','#7b78ff','#56ffc9','#ffd760','#ff6fa5','#6fc3ff','#9df06b','#55ffd1','#ff9455'];
		const applyColor = (val) => {
			const normalizedColor = getColorOrDefault(val);
			n.color = normalizedColor;
			colorInput.value = normalizedColor;
			sw.style.backgroundColor = normalizedColor;
			applySliderColors(card, normalizedColor);
			graph.render();
		};
		paletteColors.forEach((hex) => {
			const swatch = document.createElement('button');
			swatch.type = 'button';
			swatch.className = 'color-swatch';
			swatch.style.backgroundColor = hex;
			swatch.setAttribute('aria-label', `Set color ${hex}`);
			swatch.addEventListener('click', (ev) => { ev.stopPropagation(); applyColor(hex); });
			palette.appendChild(swatch);
		});
		panel.appendChild(palette);
		// Notes field
		const notesLabel = document.createElement('label'); notesLabel.textContent = 'Notes: '; notesLabel.style.alignItems = 'flex-start';
		const notesInput = document.createElement('textarea'); notesInput.className = 'node-notes-input'; notesInput.value = n.notes || ''; notesInput.placeholder = 'Your Notes Auto-Save';
		const autoResizeNotes = () => { notesInput.style.height = 'auto'; notesInput.style.height = notesInput.scrollHeight + 'px'; };
		notesInput.addEventListener('input', () => {
			autoResizeNotes();
			n.notes = notesInput.value;
			try { persistGraph(); } catch(e) {}
		});
		requestAnimationFrame(autoResizeNotes);
		notesLabel.appendChild(notesInput); panel.appendChild(notesLabel);
		stopNodeCardPropagation(notesInput);
		// live input handlers
		xInput.addEventListener('input', (ev) => { xSpan.textContent = ev.target.value; const gx = parseInt(ev.target.value,10); if (!Number.isNaN(gx)) { n.gx = Math.max(-6, Math.min(6, gx)); coords.textContent = `Matrix: ${n.gx}, ${n.gy}`; const ql = getQuadrantLabel(n.gx, n.gy); quadBadge.textContent = ql; quadBadge.dataset.quadrant = getQuadrantSlug(ql); quadBadge.style.display = ql ? '' : 'none'; row2.style.display = ql ? '' : 'none'; graph.render(); } });
		yInput.addEventListener('input', (ev) => { ySpan.textContent = ev.target.value; const gy = parseInt(ev.target.value,10); if (!Number.isNaN(gy)) { n.gy = Math.max(-6, Math.min(6, gy)); coords.textContent = `Matrix: ${n.gx}, ${n.gy}`; const ql = getQuadrantLabel(n.gx, n.gy); quadBadge.textContent = ql; quadBadge.dataset.quadrant = getQuadrantSlug(ql); quadBadge.style.display = ql ? '' : 'none'; row2.style.display = ql ? '' : 'none'; graph.render(); } });
		colorInput.addEventListener('change', (ev) => {
			const normalizedColor = getColorOrDefault(ev.target.value);
			ev.target.value = normalizedColor;
			n.color = normalizedColor;
			sw.style.backgroundColor = normalizedColor;
			applySliderColors(card, normalizedColor);
			graph.render();
		});
		// select on click - toggle open/close panel on repeated click
		const toggleSelect = () => {
			if (graph.selected.node && graph.selected.node.id === n.id) {
				graph.clearSelection();
			} else {
				graph.selectNode(n);
			}
		};
		card.addEventListener('click', toggleSelect);
		card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleSelect(); } });
		// show/hide panel depending on selection
		if (graph.selected.node && graph.selected.node.id === n.id) { card.classList.add('selected'); panel.style.display = 'block'; } else { panel.style.display = 'none'; }
		card.appendChild(panel);
		list.appendChild(card);
	});
}

// load a simple sample
function loadSample() {
	const saved = localStorage.getItem('csmatrix.graph');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
				// onChange is not yet wired when loadSample runs, so no suppression needed
				// Use fromJSON for layout, then re-apply fields it may have dropped (notes, color)
				graph.fromJSON(parsed);
				parsed.nodes.forEach(saved => {
					const live = graph.nodes.find(n => n.id === saved.id);
					if (!live) return;
					if (saved.notes) live.notes = saved.notes;
					if (saved.color) live.color = saved.color;
				});
				// Normalise any still-missing colors
				graph.nodes.forEach(n => { if (!sanitizeHexColor(n.color)) n.color = getNodeDisplayColor(n); });
				try { graph.render(); } catch(e) {}
				if (parsed.meta && parsed.meta.globalMeters) { globalMeters = parsed.meta.globalMeters; updateControlMeterBars(); }
				updateGlobalMetersUI();
				updateNodeList();
				return;
			}
			// otherwise fall back to the sample
		} catch (err) { /* continue to sample */ }
	}
	const sample = { nodes: [ { id: 'n1', name: 'Organizer', gx: -1, gy: 2 }, { id: 'n2', name: 'Ally', gx: 1, gy: 2 }, { id: 'n3', name: 'Neutral', gx: 0, gy: 0 } ], edges: [], meta: { globalMeters: { collapse: 0, influence: 2, record: 1, grit: 0 } } };
	try {
		graph.fromJSON(sample);
	} catch (err) { console.error('csmatrix: graph.fromJSON failed', err); }
	if (sample.meta && sample.meta.globalMeters) { globalMeters = sample.meta.globalMeters; updateControlMeterBars(); }
	updateGlobalMetersUI();
	// Ensure the node organizer and list are shown on initial load
	try { updateNodeList(); } catch(e) { /* ignore */ }
}
try { loadSample(); } catch (err) { console.error('csmatrix: loadSample failed', err); }
// Wire onChange only now — after loadSample — so no early render wipes localStorage
graph.onChange = () => { persistGraph(); updateNodeList(); };
	updateControlMeterBars();
	// ensure axis pills have default aria state
	document.querySelectorAll('.axis-pill').forEach(el => el.setAttribute('aria-hidden', 'false'));
	// node detail modal close handlers
	const _nodeModalEl = document.getElementById('node-detail-modal');
	if (_nodeModalEl) {
		document.getElementById('node-modal-close')?.addEventListener('click', () => { _nodeModalEl.hidden = true; });
		_nodeModalEl.addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) _nodeModalEl.hidden = true; });
		document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !_nodeModalEl.hidden) _nodeModalEl.hidden = true; });
	}
}
/* meters always visible; toggle removed */
