import React, { useEffect, useRef, useState } from 'react';

const BASE_URL = import.meta.env.BASE_URL as string;

const CHAR_SLOT_KEY = (slot: number) =>
  slot === 1 ? 'collapse.char.slot.1' : `collapse.char.slot.${slot}`;

interface ProfileData {
  pfpUrl: string;
  rawImgurInput: string;
  keyFeatures: string[];
}

const DEFAULT_DATA: ProfileData = {
  pfpUrl: '',
  rawImgurInput: '',
  keyFeatures: ['', '', ''],
};

function toDirectImgurUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\/i\.imgur\.com\//i.test(trimmed)) return trimmed;
  const pageMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)(?:[?#].*)?$/i
  );
  if (pageMatch) return `https://i.imgur.com/${pageMatch[1]}.png`;
  const albumMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?imgur\.com\/(?:gallery|a)\/([a-zA-Z0-9]+)/i
  );
  if (albumMatch) return `https://i.imgur.com/${albumMatch[1]}.png`;
  return trimmed;
}

function readProfile(storageKey: string): ProfileData {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...DEFAULT_DATA, keyFeatures: [...DEFAULT_DATA.keyFeatures] };
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DATA, keyFeatures: [...DEFAULT_DATA.keyFeatures] };
  }
}

function readCharName(slot: number): string {
  try {
    const raw = localStorage.getItem(CHAR_SLOT_KEY(slot));
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.name ?? '';
  } catch {
    return '';
  }
}

const BarcodeStripe: React.FC = () => {
  const bars = Array.from({ length: 42 }, (_, i) => {
    const widths = [1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1];
    return widths[i % widths.length];
  });
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'stretch', height: 36, gap: 2, padding: '6px 0', overflow: 'hidden' }}>
      {bars.map((w, i) => (
        <div key={i} style={{ width: w * 2, background: i % 3 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)', borderRadius: 1, flexShrink: 0 }} />
      ))}
    </div>
  );
};

// ─── DISPLAY MODE ─────────────────────────────────────────────────────────────
const DisplayCard: React.FC<{
  data: ProfileData;
  charName: string;
  miniMatrixSrc: string;
  imgError: boolean;
  onImgError: () => void;
  onEdit: () => void;
}> = ({ data, charName, miniMatrixSrc, imgError, onImgError, onEdit }) => {
  const displayName = charName || 'Unknown Operative';

  return (
    <div style={{ width: '100%', maxWidth: 340, borderRadius: 16, overflow: 'hidden', border: '1.5px solid var(--accent)', boxShadow: '0 0 0 1px rgba(15,246,255,0.08), 0 0 32px rgba(15,246,255,0.12), 0 8px 40px rgba(0,0,0,0.7)', background: 'linear-gradient(175deg, #0f1214 0%, #0c0a08 60%, #0f1214 100%)', display: 'flex', flexDirection: 'column' }}>

      {/* Header stripe — EDIT lives here so it never overlaps content */}
      <div style={{ background: 'linear-gradient(90deg, #0c2a2e 0%, #0f3a40 50%, #0c2a2e 100%)', borderBottom: '1px solid var(--accent)', padding: '8px 12px 8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.18em', fontSize: '1.05rem', color: 'var(--accent)', flex: 1 }}>COLLAPSE</span>
        <span style={{ fontSize: '0.62rem', color: 'rgba(15,246,255,0.5)', letterSpacing: '0.14em', fontFamily: 'var(--font-display)' }}>OPERATIVE ID</span>
        <button type="button" onClick={onEdit} style={{ background: 'rgba(15,246,255,0.12)', border: '1px solid rgba(15,246,255,0.3)', borderRadius: 5, color: 'var(--accent)', fontSize: '0.6rem', letterSpacing: '0.12em', fontFamily: 'var(--font-display)', padding: '3px 9px', cursor: 'pointer', flexShrink: 0 }}>EDIT</button>
      </div>

      {/* Photo */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ width: '100%', height: 200, borderRadius: 8, border: '1px solid rgba(15,246,255,0.25)', background: 'rgba(15,246,255,0.04)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {data.pfpUrl && !imgError ? (
            <img src={data.pfpUrl} alt="Profile" onError={onImgError} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'rgba(15,246,255,0.3)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              <span style={{ fontSize: '0.62rem', letterSpacing: '0.14em', fontFamily: 'var(--font-display)' }}>NO PHOTO</span>
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <div style={{ padding: '14px 16px 14px' }}>
        <div style={{ fontSize: '0.6rem', color: 'rgba(15,246,255,0.5)', letterSpacing: '0.16em', fontFamily: 'var(--font-display)', marginBottom: 3 }}>OPERATIVE NAME</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.06em', color: '#fff', lineHeight: 1, wordBreak: 'break-word' }}>{displayName}</div>
      </div>

      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(15,246,255,0.25), transparent)', margin: '0 16px' }} />

      {/* Key Features */}
      {data.keyFeatures.some(f => f.trim()) && (
        <>
          <div style={{ padding: '14px 16px 12px' }}>
            <div style={{ fontSize: '0.62rem', color: 'rgba(15,246,255,0.55)', letterSpacing: '0.18em', fontFamily: 'var(--font-display)', marginBottom: 8 }}>KEY FEATURES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.keyFeatures.filter(f => f.trim()).map((feat, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ color: 'var(--accent)', fontSize: '0.65rem', flexShrink: 0, marginTop: 2 }}>◆</span>
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.03em' }}>{feat}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(15,246,255,0.25), transparent)', margin: '0 16px' }} />
        </>
      )}

      {/* Mini CS Matrix */}
      <div style={{ padding: '12px 16px 10px' }}>
        <div style={{ fontSize: '0.62rem', color: 'rgba(15,246,255,0.55)', letterSpacing: '0.18em', fontFamily: 'var(--font-display)', marginBottom: 6 }}>CS MATRIX</div>
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(15,246,255,0.15)', aspectRatio: '1 / 1', width: '100%', background: '#07080f', position: 'relative' }}>
          <iframe
            title="CS Matrix Preview"
            src={miniMatrixSrc}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: 'none' }}
            sandbox="allow-same-origin allow-scripts"
            tabIndex={-1}
            aria-hidden
          />
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }} aria-hidden />
        </div>
      </div>

      {/* Barcode footer */}
      <div style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(15,246,255,0.12)', padding: '8px 16px 10px' }}>
        <BarcodeStripe />
        <div style={{ fontFamily: 'Courier Prime, Courier New, monospace', fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', textAlign: 'center', marginTop: 2 }}>
          COLLAPSE-RPG • OPERATIVE FILE
        </div>
      </div>
    </div>
  );
};

// ─── SETUP MODE ───────────────────────────────────────────────────────────────
const SetupForm: React.FC<{
  data: ProfileData;
  charName: string;
  imgError: boolean;
  onImgError: () => void;
  onImgReset: () => void;
  onChange: (data: ProfileData) => void;
  onDone: () => void;
}> = ({ data, charName, imgError, onImgError, onImgReset, onChange, onDone }) => {
  const featureInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [editingFeatureIdx, setEditingFeatureIdx] = useState<number | null>(null);

  const handleImgurInput = (raw: string) => {
    onImgReset();
    onChange({ ...data, rawImgurInput: raw, pfpUrl: toDirectImgurUrl(raw) });
  };

  const updateFeature = (idx: number, value: string) => {
    const updated = [...data.keyFeatures];
    updated[idx] = value;
    onChange({ ...data, keyFeatures: updated });
  };

  const addFeature = () => {
    const next = [...data.keyFeatures, ''];
    onChange({ ...data, keyFeatures: next });
    setTimeout(() => {
      featureInputRefs.current[next.length - 1]?.focus();
      setEditingFeatureIdx(next.length - 1);
    }, 50);
  };

  const removeFeature = (idx: number) => {
    const updated = data.keyFeatures.filter((_, i) => i !== idx);
    onChange({ ...data, keyFeatures: updated.length ? updated : [''] });
  };

  const displayName = charName || 'Unknown Operative';

  return (
    <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Preview row */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 72, height: 88, flexShrink: 0, borderRadius: 6, border: '1px solid rgba(15,246,255,0.3)', background: 'rgba(15,246,255,0.04)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {data.pfpUrl && !imgError ? (
            <img src={data.pfpUrl} alt="Profile" onError={onImgError} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(15,246,255,0.35)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: '0.62rem', color: 'rgba(15,246,255,0.5)', letterSpacing: '0.14em', fontFamily: 'var(--font-display)', marginBottom: 3 }}>OPERATIVE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', letterSpacing: '0.06em', color: '#fff' }}>{displayName}</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 2 }}>Name set in Character Management</div>
        </div>
      </div>

      {/* Imgur input */}
      <div style={{ background: 'rgba(15,246,255,0.03)', border: '1px solid rgba(15,246,255,0.12)', borderRadius: 10, padding: '14px' }}>
        <div style={{ fontSize: '0.62rem', color: 'rgba(15,246,255,0.55)', letterSpacing: '0.18em', fontFamily: 'var(--font-display)', marginBottom: 8 }}>PHOTO URL (IMGUR)</div>
        <input
          type="url"
          value={data.rawImgurInput}
          onChange={e => handleImgurInput(e.target.value)}
          placeholder="https://imgur.com/XXXXX"
          style={{ width: '100%', background: 'rgba(15,246,255,0.04)', border: '1px solid rgba(15,246,255,0.18)', borderRadius: 6, color: '#fff', fontSize: '0.72rem', fontFamily: 'Courier Prime, Courier New, monospace', padding: '7px 10px', outline: 'none', boxSizing: 'border-box' }}
        />
        {data.pfpUrl && data.pfpUrl !== data.rawImgurInput && (
          <div style={{ marginTop: 5, fontSize: '0.62rem', color: imgError ? '#d42b2b' : 'rgba(15,246,255,0.5)', fontFamily: 'Courier Prime, Courier New, monospace', wordBreak: 'break-all' }}>
            {imgError ? '⚠ Could not load image' : `→ ${data.pfpUrl}`}
          </div>
        )}
      </div>

      {/* Key Features */}
      <div style={{ background: 'rgba(15,246,255,0.03)', border: '1px solid rgba(15,246,255,0.12)', borderRadius: 10, padding: '14px' }}>
        <div style={{ fontSize: '0.62rem', color: 'rgba(15,246,255,0.55)', letterSpacing: '0.18em', fontFamily: 'var(--font-display)', marginBottom: 10 }}>KEY FEATURES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.keyFeatures.map((feat, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--accent)', fontSize: '0.65rem', flexShrink: 0 }}>◆</span>
              {editingFeatureIdx === idx ? (
                <input
                  ref={el => { featureInputRefs.current[idx] = el; }}
                  value={feat}
                  onChange={e => updateFeature(idx, e.target.value)}
                  onBlur={() => setEditingFeatureIdx(null)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingFeatureIdx(null); }}
                  style={{ flex: 1, background: 'rgba(15,246,255,0.06)', border: '1px solid rgba(15,246,255,0.25)', borderRadius: 4, color: '#fff', fontSize: '0.78rem', fontFamily: 'inherit', padding: '4px 8px', outline: 'none' }}
                  autoFocus
                />
              ) : (
                <button type="button" onClick={() => setEditingFeatureIdx(idx)} style={{ flex: 1, background: 'none', border: '1px solid transparent', borderRadius: 4, color: feat ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)', fontSize: '0.78rem', fontFamily: 'inherit', padding: '4px 8px', textAlign: 'left', cursor: 'text' }}>
                  {feat || `Tap to add feature…`}
                </button>
              )}
              {data.keyFeatures.length > 1 && (
                <button type="button" onClick={() => removeFeature(idx)} aria-label="Remove" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#d42b2b')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}>✕</button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addFeature} style={{ marginTop: 10, background: 'none', border: '1px dashed rgba(15,246,255,0.2)', borderRadius: 6, color: 'rgba(15,246,255,0.5)', fontSize: '0.7rem', letterSpacing: '0.1em', fontFamily: 'var(--font-display)', padding: '5px 12px', cursor: 'pointer', width: '100%' }}>
          + ADD FEATURE
        </button>
      </div>

      {/* Done */}
      <button type="button" onClick={onDone} style={{ background: 'rgba(15,246,255,0.08)', border: '1.5px solid var(--accent)', borderRadius: 10, color: 'var(--accent)', fontSize: '0.78rem', letterSpacing: '0.14em', fontFamily: 'var(--font-display)', padding: '12px', cursor: 'pointer', width: '100%' }}>
        DONE — VIEW CARD
      </button>
    </div>
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────
export default function ProfilePage({
  storageKey = 'collapse.profile.v1',
  charSlot = 1,
}: {
  storageKey?: string;
  charSlot?: number;
}) {
  const [data, setData] = useState<ProfileData>(() => readProfile(storageKey));
  const [charName, setCharName] = useState(() => readCharName(charSlot));
  const [mode, setMode] = useState<'display' | 'setup'>('display');
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setCharName(readCharName(charSlot)); }, [charSlot]);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(data)); }, [data, storageKey]);
  useEffect(() => { setImgError(false); }, [data.pfpUrl]);

  const miniMatrixSrc = `${BASE_URL}csmatrix/index.html?mini=1`;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem 1rem 4rem' }}>
      {mode === 'display' ? (
        <DisplayCard
          data={data}
          charName={charName}
          miniMatrixSrc={miniMatrixSrc}
          imgError={imgError}
          onImgError={() => setImgError(true)}
          onEdit={() => setMode('setup')}
        />
      ) : (
        <SetupForm
          data={data}
          charName={charName}
          imgError={imgError}
          onImgError={() => setImgError(true)}
          onImgReset={() => setImgError(false)}
          onChange={setData}
          onDone={() => setMode('display')}
        />
      )}
    </div>
  );
}
