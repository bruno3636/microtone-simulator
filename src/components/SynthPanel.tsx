import { useStore } from '../state/store';
import { PRESET_ORDER, SYNTH_PRESETS, type PresetId } from '../state/presets';
import { HarmonicsEditor } from './HarmonicsEditor';
import { EnvelopeEditor } from './EnvelopeEditor';
import { Segmented, Slider } from './ui';

const OPTIONS: { value: PresetId; label: string }[] = [
  ...PRESET_ORDER.map((id) => ({ value: id as PresetId, label: SYNTH_PRESETS[id].label })),
  { value: 'custom', label: 'Custom' },
];

export function SynthPanel() {
  const preset = useStore((s) => s.preset);
  const volume = useStore((s) => s.volume);
  const space = useStore((s) => s.space);
  const { applyPreset, setVolume, setSpace } = useStore.getState();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="label">Preset</span>
          <Segmented<PresetId> label="Synth preset" value={preset} options={OPTIONS}
            onChange={(id) => { if (id !== 'custom') applyPreset(id); }} />
        </div>
        <div className="flex flex-wrap gap-6">
          <Slider label="Volume" value={volume} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={setVolume} />
          <Slider label="Space (reverb)" value={space} min={0} max={1} step={0.01}
            format={(v) => (v === 0 ? 'dry' : `${Math.round(v * 100)}%`)} onChange={setSpace} />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <HarmonicsEditor />
        <EnvelopeEditor />
      </div>
    </div>
  );
}
