import React, { useState } from 'react';
import type { LabSettings } from '../game/lab';

interface Props { settings: LabSettings; onChange: (settings: LabSettings) => void;
  onReset: () => void; onTargets: () => void; onClear: () => void; onExit: () => void }
export default function FeelLab({ settings, onChange, onReset, onTargets, onClear, onExit }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const set = <K extends keyof LabSettings>(key: K, value: LabSettings[K]) => onChange({ ...settings, [key]: value });
  const range = (key: 'split' | 'cooling' | 'rails' | 'ricochet' | 'thrust' | 'steering', label: string, min: number, max: number, step = 1) => (
    <label style={{ display: 'grid', gridTemplateColumns: '100px 1fr 26px', gap: 6, alignItems: 'center', margin: '8px 0' }}>
      <span>{label}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key]}
        onChange={e => set(key, Number(e.target.value))} /><span>{settings[key]}</span>
    </label>);
  const buttonStyle: React.CSSProperties = { background: '#273b46', border: '1px solid #59717c', padding: '6px 8px', borderRadius: 3, color: '#e0e6df', cursor: 'pointer' };
  return <aside aria-label="Game-feel experiment lab" style={{ position: 'absolute', top: 45, right: 12, width: 254,
    maxHeight: 'calc(100vh - 65px)', overflowY: 'auto', zIndex: 25, padding: 14,
    color: '#b9c9cb', background: '#101a22ee', border: '1px solid #53646a', borderRadius: 5, font: '11px monospace' }}>
    <button style={{ ...buttonStyle, width: '100%', textAlign: 'left', color: '#e4b86c' }} onClick={() => setCollapsed(!collapsed)}>
      MASS & MAYHEM / LAB {collapsed ? '+' : '−'}</button>
    {!collapsed && <>
      <p style={{ margin: '10px 0', lineHeight: 1.5 }}>Arrow keys fly. Guns fire automatically. Changes apply live. Material, size and motion replace the targets. Click the arena after using sliders to fly.</p>
      <label>Handling <select aria-label="Handling profile" value={settings.profile} onChange={e => set('profile', e.target.value as LabSettings['profile'])}>
        <option value="gunship">Gunship · default</option><option value="drifter">Drifter · long coast</option><option value="precise">Precise · quick arrest</option>
      </select></label>
      {range('thrust', 'Thrust', .5, 1.5, .1)}{range('steering', 'Turn response', .5, 1.5, .1)}
      <hr style={{ borderColor: '#34464e', margin: '12px 0' }} />
      {range('split', 'Split Shot tier', 0, 9)}{range('cooling', 'Hyper-Cooling', 0, 12)}
      {range('rails', 'Magnetic Rails', 0, 6)}{range('ricochet', 'Ricochet', 0, 5)}
      <hr style={{ borderColor: '#34464e', margin: '12px 0' }} />
      <label>Material <select aria-label="Target material" value={settings.material} onChange={e => set('material', e.target.value as LabSettings['material'])}>
        {['REGULAR', 'MOLTEN', 'FROZEN', 'IRON', 'TUNGSTEN'].map(m => <option key={m}>{m}</option>)}
      </select></label>
      <label style={{ display: 'block', marginTop: 10 }}>Size <select aria-label="Target size" value={settings.size} onChange={e => set('size', Number(e.target.value) as LabSettings['size'])}>
        {['Small', 'Medium', 'Large', 'Massive'].map((size, i) => <option key={size} value={i + 1}>{size}</option>)}
      </select></label>
      {(['moving', 'firing', 'repeat', 'immortal'] as const).map((key, i) => <label key={key} style={{ display: 'block', marginTop: 9 }}>
        <input type="checkbox" checked={settings[key]} onChange={e => set(key, e.target.checked)} /> {['Moving targets', 'Auto fire', 'Repeat cleared targets', 'Reinforced test hull'][i]}</label>)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 14 }}>
        <button style={buttonStyle} onClick={onTargets}>Respawn targets</button><button style={buttonStyle} onClick={onClear}>Clear field</button>
        <button style={buttonStyle} onClick={onReset}>Reset experiment</button><button style={buttonStyle} onClick={onExit}>Exit to menu</button>
      </div>
      <p style={{ marginTop: 10, color: '#859ca4', lineHeight: 1.5 }}>Clear field also disables repeat. F3 shows counts/FPS. Test targets keep real HP, splitting, auras and shard behavior. No run progression in the lab.</p>
    </>}
    <style>{`select { background: #22333d; color: #dbe4e1; border: 1px solid #53646a; padding: 3px; max-width: 170px; } input[type=range] { min-width: 0; width: 100%; accent-color: #d3a966; }`}</style>
  </aside>;
}
