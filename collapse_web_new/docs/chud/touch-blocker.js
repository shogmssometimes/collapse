(function(){
  'use strict';
  function clearSelectionUnlessSelectable() {
    try {
      const sel = window.getSelection && window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const anchor = sel.anchorNode && (sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode);
      if (anchor && anchor.closest && anchor.closest('.selectable')) return;
      sel.removeAllRanges();
    } catch (e) {
      // ignore
    }
  }

  function attachTouchBlockerTo(el) {
    if (!el || el.matches('[data-touch-blocker-ignore]')) return;
    if (el._touchBlockerAttached) return;
    const cs = window.getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    el.classList.add('has-touch-blocker');

    const blocker = document.createElement('span');
    blocker.className = 'touch-blocker';
    blocker.setAttribute('aria-hidden','true');
    blocker.setAttribute('tabindex','-1');

    let downTime = 0; let holdTimer = null; let startX = 0; let startY = 0;
    const cancelHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };

    const onPointerDown = (e) => {
      if (e.pointerType && e.pointerType !== 'touch') return;
      const target = e.target instanceof Element ? e.target : null;
      if (target && target.closest && target.closest('.selectable')) return;
      downTime = Date.now(); startX = e.clientX || 0; startY = e.clientY || 0; cancelHold();
      holdTimer = setTimeout(() => { clearSelectionUnlessSelectable(); try { el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true})); } catch(e){} holdTimer = null; }, 350);
      e.preventDefault();
    };
    const onPointerMove = (e) => { const x = e.clientX||0, y = e.clientY||0; if (Math.abs(x-startX)>10 || Math.abs(y-startY)>10) cancelHold(); };
    const onPointerUp = (e) => { if (e.pointerType && e.pointerType !== 'touch') return; if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } const dt = Date.now()-downTime; downTime=0; if (dt<350) el.click(); };

    blocker.addEventListener('pointerdown', onPointerDown, { passive:false });
    blocker.addEventListener('pointermove', onPointerMove, { passive:true });
    blocker.addEventListener('pointerup', onPointerUp, { passive:true });

    // touch fallbacks
    blocker.addEventListener('touchstart', (e)=>{ const t = e.changedTouches[0]; const target = e.target instanceof Element ? e.target : null; if (target && target.closest && target.closest('.selectable')) return; downTime = Date.now(); startX = t.clientX||0; startY = t.clientY||0; cancelHold(); holdTimer = setTimeout(()=>{ clearSelectionUnlessSelectable(); try { el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true})); } catch(e){} holdTimer = null; }, 350); e.preventDefault(); }, { passive:false });
    blocker.addEventListener('touchmove', (e)=>{ const t = e.changedTouches[0]; if (!t) return; if (Math.abs((t.clientX||0)-startX)>10 || Math.abs((t.clientY||0)-startY)>10) cancelHold(); }, { passive:true });
    blocker.addEventListener('touchend', (e)=>{ if (holdTimer){ clearTimeout(holdTimer); holdTimer=null; } const dt = Date.now()-downTime; downTime=0; if (dt<350) el.click(); }, { passive:true });

    el.insertBefore(blocker, el.firstChild);
    el._touchBlockerAttached = true;
  }

  function attachToAll() {
    try {
      const selector = 'button, a[href], [role="button"], .button, .counter-btn, .card, .stat-card, .core-card, .interactive, .stat-large';
      document.querySelectorAll(selector).forEach((el)=>{ if (el instanceof HTMLElement) attachTouchBlockerTo(el); });
    } catch(e) {}
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    attachToAll();
    try {
      const selector = 'button, a[href], [role="button"], .button, .counter-btn, .card, .stat-card, .core-card, .interactive, .stat-large';
      const mo = new MutationObserver((mutations)=>{ mutations.forEach((m)=>{ m.addedNodes.forEach((node)=>{ if (!(node instanceof HTMLElement)) return; if (node.matches && node.matches(selector)) attachTouchBlockerTo(node); node.querySelectorAll && node.querySelectorAll(selector).forEach((el)=>{ if (el instanceof HTMLElement) attachTouchBlockerTo(el); }); }); }); });
      mo.observe(document.body, { childList:true, subtree:true });
    } catch(e){}

    // global selection clearing as a fallback
    document.addEventListener('selectionchange', ()=>{ requestAnimationFrame(clearSelectionUnlessSelectable); }, { passive: true });
    document.addEventListener('pointerdown', clearSelectionUnlessSelectable, { passive: true });
    document.addEventListener('touchstart', clearSelectionUnlessSelectable, { passive: true });
  });
})();