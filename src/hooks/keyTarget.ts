const TEXT_TYPES = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password']);

/**
 * True when the focused element consumes typed characters (so note keys must not fire).
 * Range, checkbox, radio, button, color etc. never block note keys. SELECT counts as
 * text entry (type-ahead); TuningPanel blurs it after pointer changes so keys resume.
 */
export function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.tagName === 'INPUT') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    return TEXT_TYPES.has(type);
  }
  return false;
}

/**
 * The key a keymap entry refers to. With Shift held, `key` is the shifted character ("A", "@"),
 * so letters and digits are read from the physical key (`code`) instead.
 */
export function baseKey(key: string, code: string, shift: boolean): string {
  if (!shift) return key;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return key;
}

/** Keyboard shift-sustain: Shift + key sustains; any key press releases a sustained pitch. */
export function latchAction(shift: boolean, latched: boolean): 'latch' | 'unlatch' | 'play' {
  if (latched) return 'unlatch';
  return shift ? 'latch' : 'play';
}
