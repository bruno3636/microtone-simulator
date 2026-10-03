import { useEffect } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';

export function useEngineSync(): void {
  const harmonics = useStore((s) => s.harmonics);
  const darkHarmonics = useStore((s) => s.darkHarmonics);
  const brightnessTau = useStore((s) => s.brightnessTau);
  const envelope = useStore((s) => s.envelope);
  const volume = useStore((s) => s.volume);
  const space = useStore((s) => s.space);
  useEffect(
    () => engine.setTimbre(harmonics, darkHarmonics ? { harmonics: darkHarmonics, tauMs: brightnessTau } : null),
    [harmonics, darkHarmonics, brightnessTau],
  );
  useEffect(() => engine.setEnvelope(envelope), [envelope]);
  useEffect(() => engine.setMasterVolume(volume), [volume]);
  useEffect(() => engine.setReverbMix(space), [space]);
}
