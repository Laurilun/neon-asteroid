import React, { useState } from 'react';
import { FLIGHT_MODES } from '../game/movement';
import type { Trial } from '../game/trials';

const field: React.CSSProperties = { background: '#172a38', color: '#e2e4d8', border: '1px solid #4b6272', padding: '4px', borderRadius: 3, maxWidth: 140 };
const button: React.CSSProperties = { ...field, cursor: 'pointer', padding: '6px 10px', color: '#fac47c' };
export default function TrialConsole({ value, change, reset, pause, paused, exit }: {
  value: Trial; change: (value: Trial) => void; reset: () => void; pause: () => void; paused: boolean; exit: () => void;
}) {
  const [open, setOpen] = useState(true);
  const set = <K extends keyof Trial>(key: K, val: Trial[K]) => change({ ...value, [key]: val });
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '7px 0' };
  const slider = (key: 'power' | 'split' | 'cooling' | 'rails' | 'bounce', label: string, max: number) => <label style={row}>{label}<span>
    <input aria-label={label} type="range" min={key === 'power' ? .5 : 0} max={max} step={key === 'power' ? .1 : 1}
      value={value[key]} onChange={e => set(key, Number(e.target.value))} style={{ width: 80, accentColor: '#e8ab5d', verticalAlign: 'middle' }} /> {value[key]}</span></label>;
  const toggle = (key: 'targets' | 'moving' | 'fire' | 'safe' | 'repeat', label: string) => <label style={row}>{label}<input type="checkbox" checked={value[key]} onChange={e => set(key, e.target.checked)} /></label>;
  return <section aria-label="Experiment console" onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()}
    style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 'min(850px, calc(100vw - 32px))', zIndex: 30,
      background: '#0b1724ed', border: '1px solid #42596b', color: '#c2cfd3', padding: 12, borderRadius: 7, font: '11px monospace', maxHeight: '45vh', overflowY: 'auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button style={button} onClick={() => setOpen(!open)} aria-expanded={open}>MASS / MAYHEM · TEST BAY {open ? '−' : '+'}</button>
      <span>Arrows fly · P pause · R reset</span>
      <div style={{ display: 'flex', gap: 6 }}><button style={button} onClick={reset}>Reset trial</button><button style={button} onClick={pause}>{paused ? 'Resume' : 'Pause'}</button><button style={button} onClick={exit}>Exit</button></div>
    </div>
    {open && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 24, marginTop: 8 }}>
      <div><strong style={{ color: '#e7c49a' }}>01 / FLIGHT</strong>
        <label style={row}>Handling<select aria-label="Handling" style={field} value={value.flight} onChange={e => set('flight', e.target.value as Trial['flight'])}>
          {Object.entries(FLIGHT_MODES).map(([key, mode]) => <option key={key} value={key}>{mode.name}</option>)}
        </select></label>{slider('power', 'Thrust', 1.8)}{toggle('safe', 'Damage immunity')}{toggle('fire', 'Auto cannon')}
      </div>
      <div><strong style={{ color: '#e7c49a' }}>02 / BATTERY</strong>
        {slider('split', 'Split Shot', 9)}{slider('cooling', 'Hyper-Cooling', 10)}{slider('rails', 'Magnetic Rails', 6)}{slider('bounce', 'Ricochet', 4)}
      </div>
      <div><strong style={{ color: '#e7c49a' }}>03 / TARGETS · RESET TO APPLY</strong>
        <label style={row}>Material<select aria-label="Material" style={field} value={value.material} onChange={e => set('material', e.target.value as Trial['material'])}>
          {['REGULAR', 'MOLTEN', 'FROZEN', 'IRON', 'TUNGSTEN'].map(type => <option key={type}>{type}</option>)}
        </select></label>
        <label style={row}>Size<select aria-label="Size" style={field} value={value.size} onChange={e => set('size', Number(e.target.value) as Trial['size'])}>
          {['Small', 'Medium', 'Large', 'Massive'].map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
        </select></label>{toggle('targets', 'Spawn targets')}{toggle('moving', 'Moving targets')}{toggle('repeat', 'Repeat when cleared')}
      </div>
    </div>}
  </section>;
}
