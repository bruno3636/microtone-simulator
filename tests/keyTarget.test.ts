import { describe, it, expect } from 'vitest';
import { isTextEntry } from '../src/hooks/keyTarget';

const input = (type?: string) => {
  const el = document.createElement('input');
  if (type !== undefined) el.setAttribute('type', type);
  return el;
};

describe('isTextEntry', () => {
  it('is true for text-entry controls', () => {
    for (const t of [undefined, 'text', 'number', 'search', 'email', 'url', 'tel', 'password', 'TEXT']) {
      expect(isTextEntry(input(t)), String(t)).toBe(true);
    }
    expect(isTextEntry(document.createElement('textarea'))).toBe(true);
  });
  it('is true for contentEditable and selects', () => {
    const div = document.createElement('div');
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(isTextEntry(div)).toBe(true);
    expect(isTextEntry(document.createElement('select'))).toBe(true);
  });
  it('is false for non-text inputs and other elements', () => {
    for (const t of ['range', 'checkbox', 'radio', 'button', 'color', 'submit', 'file']) {
      expect(isTextEntry(input(t)), t).toBe(false);
    }
    expect(isTextEntry(document.createElement('button'))).toBe(false);
    expect(isTextEntry(document.body)).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});
