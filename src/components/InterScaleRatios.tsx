import { useStore } from '../state/store';
import { interScaleRatios } from '../tuning/interScale';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { Section } from './ui';

export function InterScaleRatios() {
  const dark = useResolvedTheme() === 'dark';
  const open = useStore((s) => s.open.ratios);
  const notes = useStore((s) => s.notes);
  const shown = useStore((s) => s.shown);
  const held = useStore((s) => s.held);
  const toggleOpen = useStore((s) => s.toggleOpen);
  const rows = open ? interScaleRatios(notes, [...shown, ...held]) : [];
  const chip = (i: number) => (
    <span className="mono px-1.5" style={{ background: degreeColor(i, dark), color: '#111' }}>f{i + 1}</span>
  );
  return (
    <Section title="Inter-scale ratios" open={open} onToggle={() => toggleOpen('ratios')}>
      {rows.length === 0 ? (
        <p className="label normal-case tracking-normal">Show (~) or play at least two scale degrees.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {rows.map((row, r) => (
            <div key={r} className="panel flex flex-col gap-2 p-3">
              {row.map((x) => (
                <div key={`${x.lo}-${x.hi}`} className="flex items-center gap-2 text-sm">
                  {chip(x.hi)}<span>/</span>{chip(x.lo)}<span>=</span>
                  <span className="mono">{x.exact}</span><span className="label">≈</span>
                  <span className="mono">{x.decimal}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
