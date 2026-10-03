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

import { baseKey, latchAction } from '../src/hooks/keyTarget';

describe('baseKey (the unshifted key a keymap entry refers to)', () => {
  it('uses the physical key when Shift is held', () => {
    expect(baseKey('A', 'KeyA', true)).toBe('a');
    expect(baseKey('@', 'Digit2', true)).toBe('2');
  });
  it('uses the typed key otherwise', () => {
    expect(baseKey('a', 'KeyA', false)).toBe('a');
    expect(baseKey(',', 'Comma', false)).toBe(',');
    expect(baseKey('<', 'Comma', true)).toBe('<');
  });
});

describe('latchAction (shift-sustain from the keyboard)', () => {
  it('Shift + key sustains a pitch that is not sustained', () => {
    expect(latchAction(true, false)).toBe('latch');
  });
  it('any key press releases a sustained pitch', () => {
    expect(latchAction(true, true)).toBe('unlatch');
    expect(latchAction(false, true)).toBe('unlatch');
  });
  it('a plain key press plays normally', () => {
    expect(latchAction(false, false)).toBe('play');
  });
});
