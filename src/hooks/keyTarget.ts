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
