import { Header } from './components/Header';
import { Segmented } from './components/ui';
import { useStore } from './state/store';
import { useKeyboard } from './hooks/useKeyboard';
import { useEngineSync } from './hooks/useEngineSync';
import { useResolvedTheme } from './hooks/useTheme';
import { TuningPanel } from './components/TuningPanel';
import { DegreeGrid } from './components/DegreeGrid';
import { KeyboardMap } from './components/KeyboardMap';
import { InterScaleRatios } from './components/InterScaleRatios';

export default function App() {
  useResolvedTheme();
  useKeyboard();
  useEngineSync();
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-3">
          <Segmented label="Panel" value={tab} onChange={setTab}
            options={[{ value: 'tuning', label: 'Tuning' }, { value: 'synth', label: 'Synthesizer' }]} />
          <div className="panel p-4">
            {tab === 'tuning' ? <TuningPanel /> : <>{/* SYNTH_PANEL */}</>}
          </div>
        </div>
        {/* VISUALIZER */}
        <DegreeGrid />
        <KeyboardMap />
        <InterScaleRatios />
      </main>
      <footer className="mx-auto max-w-[1200px] px-4 pb-8">
        <p className="label normal-case tracking-normal">
          Based on <a className="underline" href="https://github.com/flappix/web_intonation">web_intonation</a> by flappix.
        </p>
      </footer>
    </>
  );
}
