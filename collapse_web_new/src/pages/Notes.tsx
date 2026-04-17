import React, { useEffect, useRef, useState } from 'react';

const NOTES_STORAGE_KEY = 'collapse.notes.v1';

type NoteModule = {
  id: string;
  title: string;
  content: string;
  collapsed: boolean;
};

const createModule = (overrides?: Partial<NoteModule>): NoteModule => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: 'Untitled',
  content: '',
  collapsed: true,
  ...overrides,
});

function loadSavedNotes(): NoteModule[] {
  if (typeof window === 'undefined') return [createModule({ title: 'Notes' })];
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [createModule({ title: 'Notes' })];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item === 'object')) {
        return parsed.map((item) => ({
          id: typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: typeof item.title === 'string' ? item.title : 'Untitled',
          content: typeof item.content === 'string' ? item.content : '',
          collapsed: typeof item.collapsed === 'boolean' ? item.collapsed : true,
        }));
      }
    } catch {
      // not JSON, fall through to legacy string content
    }
    return [createModule({ title: 'Notes', content: raw })];
  } catch {
    return [createModule({ title: 'Notes' })];
  }
}

export default function NotesPage() {
  const [modules, setModules] = useState<NoteModule[]>(() => loadSavedNotes());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(modules));
    } catch {
      // ignore write failures
    }
  }, [modules]);

  const updateModule = (id: string, updates: Partial<NoteModule>) => {
    setModules((prev) => prev.map((module) => (module.id === id ? { ...module, ...updates } : module)));
  };

  const moveModule = (index: number, direction: 'up' | 'down') => {
    setModules((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const deleteModule = (id: string) => {
    setModules((prev) => (prev.length <= 1 ? prev : prev.filter((module) => module.id !== id)));
  };

  const holdTimerRef = useRef<Record<string, number | null>>({});

  const toggleCollapsed = (id: string) => {
    setModules((prev) => prev.map((module) => (module.id === id ? { ...module, collapsed: !module.collapsed } : module)));
  };

  const cancelLongPress = (id: string) => {
    const timer = holdTimerRef.current[id];
    if (timer) {
      window.clearTimeout(timer);
      holdTimerRef.current[id] = null;
    }
  };

  const startLongPress = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('textarea')) return;
    cancelLongPress(id);
    holdTimerRef.current[id] = window.setTimeout(() => {
      toggleCollapsed(id);
      holdTimerRef.current[id] = null;
    }, 450);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 style={{ margin: '0', fontSize: '3rem', letterSpacing: '0.06em' }}>NOTES</h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 0 2rem 0' }}>
        {modules.map((module, index) => (
          <div
            key={module.id}
            style={{
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              padding: '14px 14px 12px',
              display: 'grid',
              gap: '10px',
            }}
          >
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div
                  onPointerDown={(event) => startLongPress(module.id, event)}
                  onPointerUp={() => cancelLongPress(module.id)}
                  onPointerLeave={() => cancelLongPress(module.id)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.06)',
                    display: 'grid',
                    placeItems: 'center',
                    color: module.collapsed ? '#ff8a80' : '#63ffb1',
                    cursor: 'pointer',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                  title={module.collapsed ? 'Hold to reveal' : 'Hold to hide'}
                >
                  <span style={{ fontSize: '1.3rem' }}>{module.collapsed ? '🚫' : '👁'}</span>
                </div>
                <input
                  value={module.title}
                  onChange={(event) => updateModule(module.id, { title: event.target.value })}
                  placeholder="Module Title"
                  style={{
                    flex: 1,
                    minWidth: 160,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.16)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'inherit',
                    padding: '10px 12px',
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => moveModule(index, 'up')}
                    disabled={index === 0}
                    style={{
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'inherit',
                      padding: '8px 10px',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveModule(index, 'down')}
                    disabled={index === modules.length - 1}
                    style={{
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'inherit',
                      padding: '8px 10px',
                      cursor: index === modules.length - 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteModule(module.id)}
                    disabled={modules.length <= 1}
                    style={{
                      borderRadius: 10,
                      border: '1px solid rgba(255,80,80,0.4)',
                      background: 'rgba(255,80,80,0.08)',
                      color: modules.length <= 1 ? 'rgba(255,255,255,0.35)' : '#ff8a80',
                      padding: '8px 12px',
                      cursor: modules.length <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {!module.collapsed && (
                <textarea
                  value={module.content}
                  onChange={(event) => updateModule(module.id, { content: event.target.value })}
                  placeholder="Write notes for this module..."
                  style={{
                    width: '100%',
                    minHeight: 180,
                    resize: 'vertical',
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'inherit',
                    padding: '12px',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    outline: 'none',
                  }}
                />
              )}
              {module.collapsed && (
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem', padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                  Long-press the icon to show this note.
                </div>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setModules((prev) => [...prev, createModule({ title: 'Untitled' })])}
          style={{
            borderRadius: 14,
            border: '1px solid rgba(99,255,177,0.4)',
            background: 'rgba(99,255,177,0.08)',
            color: '#63ffb1',
            padding: '12px 16px',
            alignSelf: 'flex-start',
            cursor: 'pointer',
          }}
        >
          Add new module
        </button>
      </div>
    </div>
  );
}
