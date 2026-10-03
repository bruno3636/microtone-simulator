import { useEffect, useState } from 'react';

const QUERY = '(hover: hover) and (pointer: fine)';

/** True on devices with a mouse/trackpad (computers), false on touch-first devices (phones, tablets). */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.(QUERY).matches ?? true));
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const onChange = () => setFine(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return fine;
}
