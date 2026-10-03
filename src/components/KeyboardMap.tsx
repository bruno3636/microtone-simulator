import { useStore } from '../state/store';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { Section } from './ui';

const EMPTY: Record<string, string> = {};

export function KeyboardMap() {
  const dark = useResolvedTheme() === 'dark';
  const open = useStore((s) => s.open.keyboard);
  const map = useStore((s) => s.keymaps[s.keymap]) ?? EMPTY; // stable fallback: zustand v5 needs referentially stable selector results
  const len = useStore((s) => s.notes.length);
  const held = useStore((s) => s.held);
  const { toggleOpen, setKey, deleteKeyDegree, addKeyDegree } = useStore.getState();
  return (
    <Section title="Keyboard" open={open} onToggle={() => toggleOpen('keyboard')}
      right={<span className="label">comma-separated keys · “f2” = one octave up</span>}>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4 lg:grid-cols-7">
        {Object.entries(map).map(([deg, keys]) => {
          const d = Number(deg);
          return (
            <div key={deg} className="flex items-center gap-2 border p-2"
              style={{
                borderColor: 'var(--border-subtle)',
                background: held.includes(d) ? degreeColor(d % len, dark, 0.25) : 'var(--bg-raised)',
              }}>
              <span className="mono w-8 shrink-0 text-center text-xs" style={{ background: degreeColor(d % len, dark), color: '#111' }}>{d + 1}</span>
              <input className="input mono w-full text-center" value={keys} aria-label={`Keys for degree ${d + 1}`}
                onChange={(e) => setKey(d, e.target.value)} />
              <button type="button" className="btn px-1.5 py-0.5" title="Remove" onClick={() => deleteKeyDegree(d)}>×</button>
            </div>
          );
        })}
        <button type="button" className="btn" onClick={addKeyDegree}>+</button>
      </div>
    </Section>
  );
}
