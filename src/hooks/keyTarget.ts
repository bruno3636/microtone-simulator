const TEXT_TYPES = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password']);

/** Keys a number field types: digits, decimal point and sign. */
export const isNumericKey = (key: string) => /^[0-9.+-]$/.test(key);

/**
 * True when the focused element consumes typed characters (so note keys must not fire).
 * Range, checkbox, radio, button, color etc. never block note keys. SELECT counts as
 * text entry (type-ahead); TuningPanel blurs it after pointer changes so keys resume.
 */
export function isTextEntry(el: Element | null, key?: string): boolean {
  if (!el) return false;
  // number fields keep only number keys; any other key falls through to play its note
  if ((el as HTMLElement).dataset?.numeric != null) return key == null || isNumericKey(key) || key.length > 1;
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

/** US-layout character of a physical punctuation key (`KeyboardEvent.code`), for keymap fallback. */
const PHYSICAL: Record<string, string> = {
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`',
};

/**
 * Keys to look up in the keymap for a key press: the typed character first, then — for punctuation —
 * the character printed on that physical key in the US layout, so ";" and "'" (right of L) still
 * play on layouts where that key types something else (e.g. "ñ" on Spanish keyboards).
 */
export function noteKeys(key: string, code: string, shift: boolean): string[] {
  const typed = baseKey(key, code, shift);
  const physical = PHYSICAL[code];
  return physical && physical !== typed ? [typed, physical] : [typed];
}
