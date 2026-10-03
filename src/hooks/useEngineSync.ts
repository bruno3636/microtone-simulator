import { useEffect } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';

export function useEngineSync(): void {
  const harmonics = useStore((s) => s.harmonics);
  const envelope = useStore((s) => s.envelope);
  const volume = useStore((s) => s.volume);
  const space = useStore((s) => s.space);
  useEffect(() => engine.setTimbre(harmonics), [harmonics]);
  useEffect(() => engine.setEnvelope(envelope), [envelope]);
  useEffect(() => engine.setMasterVolume(volume), [volume]);
  useEffect(() => engine.setReverbMix(space), [space]);
}
