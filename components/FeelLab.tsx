import React, { useState } from 'react';
import { HANDLING_PROFILES } from '../game/movement';
import type { LabSettings } from '../game/lab';

const panel: React.CSSProperties = {
  position: 'absolute', right: 14, top: 58, width: 268, maxHeight: 'calc(100vh - 90px)', overflowY: 'auto',
  zIndex: 25, background: 'rgba(12,22,30,.95)', color: '#c7d3d3', border: '1px solid #40545e',
  borderRadius: 6, boxShadow: '0 8px 32px #0006', font: '11px ui-monospace, monospace', padding: 14,
};
const field: React.CSSProperties = { background: '#172731', color: '#d9e2db', border: '1px solid #40535e', borderRadius: 3, padding: '4px 6px', width: 130 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 9 };
const button: React.CSSProperties = { ...field, cursor: 'pointer', width: '100%', marginTop: 10, padding: 8, color: '#f1d49e' };

export default function FeelLab({ settings, onChange, onReset, onExit, onPause, paused, onInteract }: {
  settings: LabSettings; onChange: (settings: LabSettings) => void; onReset: () => void;
  onExit: () => void; onPause: () => void; paused: boolean;
  onInteract: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const set = <K extends keyof LabSettings>(key: K, value: LabSettings[K]) => onChange({ ...settings, [key]: value });
  const slider = (key: 'split' | 'rapid' | 'rails' | 'ricochet' | 'thrust' | 'impact' | 'shake', label: string, max: number, step = 1, min = 0) => (
    <label style={row} key={key}>{label} <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key]}
        onChange={e => set(key, Number(e.target.value))} style={{ width: 92, accentColor: '#c9a570' }} />
      <span style={{ width: 23, textAlign: 'right' }}>{settings[key]}</span>
    </span></label>
  );
  return <aside aria-label="Game-feel experiment lab" style={panel} onFocusCapture={onInteract} onPointerDownCapture={onInteract} onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()}>
    <button style={{ background: 'none', color: '#edcf99', border: 0, width: '100%', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 700, letterSpacing: 1 }}
      onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>MASS & MAYHEM LAB <span>{collapsed ? '+' : '−'}</span></button>
    {!collapsed && <>
      <p style={{ color: '#82979e', margin: '8px 0 12px', lineHeight: 1.5 }}>Click arena → arrows fly · P pauses<br />Auto cannon · real damage and breakup</p>
      <div style={{ borderTop: '1px solid #30434c', paddingTop: 2 }}>
        <label style={row}>Handling <select aria-label="Handling preset" style={field} value={settings.profile} onChange={e => set('profile', e.target.value as LabSettings['profile'])}>
          {Object.entries(HANDLING_PROFILES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select></label>
        {slider('thrust', 'Engine power', 1.6, 0.1, 0.6)}
        {slider('impact', 'Contact impulse', 1.5, 0.1, 0.5)}
        {slider('shake', 'Shake strength', 1, 0.1)}
      </div>
      <div style={{ borderTop: '1px solid #30434c', marginTop: 12, paddingTop: 2 }}>
        {slider('split', 'Split Shot', 10)}
        {slider('rapid', 'Hyper-Cooling', 12)}
        {slider('rails', 'Magnetic Rails', 6)}
        {slider('ricochet', 'Ricochet', 5)}
        <p style={{ color: '#8fa5ab', marginTop: 6 }}>Up to 8 visible barrels. Tiers 8+ reinforce them.</p>
      </div>
      <div style={{ borderTop: '1px solid #30434c', marginTop: 12, paddingTop: 2 }}>
        <label style={row}>Material <select aria-label="Target material" style={field} value={settings.material} onChange={e => set('material', e.target.value as LabSettings['material'])}>
          {['REGULAR', 'MOLTEN', 'FROZEN', 'IRON', 'TUNGSTEN'].map(type => <option key={type}>{type}</option>)}
        </select></label>
        <label style={row}>Size <select aria-label="Target size" style={field} value={settings.size} onChange={e => set('size', Number(e.target.value) as LabSettings['size'])}>
          {['Small', 'Medium', 'Large', 'Huge'].map((size, i) => <option key={size} value={i + 1}>{size}</option>)}
        </select></label>
        {(['moving', 'immortal', 'repeat'] as const).map((key, i) => <label style={row} key={key}>{['Moving targets', 'Ship damage immunity', 'Repeat after breakup'][i]}
          <input type="checkbox" checked={settings[key]} onChange={e => set(key, e.target.checked)} style={{ accentColor: '#c9a570' }} /></label>)}
        <p style={{ color: '#82979e', marginTop: 8 }}>Material, size and motion apply on reset.</p>
      </div>
      <button style={button} onClick={onReset}>RESET TRIAL / APPLY TARGETS</button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={button} onClick={onPause}>{paused ? 'RESUME' : 'PAUSE'}</button>
        <button style={button} onClick={onExit}>EXIT TO MENU</button>
      </div>
    </>}
  </aside>;
}
