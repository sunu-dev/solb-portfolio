import { describe, expect, it } from 'vitest';
import { canShowAutomaticPrompt } from '@/lib/automaticPrompt';

function page({ hidden = false, modal = false, editing = false } = {}) {
  return {
    visibilityState: hidden ? 'hidden' : 'visible',
    querySelector: () => modal ? {} : null,
    activeElement: { closest: () => editing ? {} : null },
  } as unknown as Document;
}

describe('automatic prompts preserve the current task', () => {
  it('allows an automatic notice on an idle visible page', () => {
    expect(canShowAutomaticPrompt(page())).toBe(true);
  });
  it('does not take focus from an open modal', () => {
    expect(canShowAutomaticPrompt(page({ modal: true }))).toBe(false);
  });
  it('does not interrupt input, including a child inside an editable area', () => {
    expect(canShowAutomaticPrompt(page({ editing: true }))).toBe(false);
  });
  it('does not open a notice in a background tab', () => {
    expect(canShowAutomaticPrompt(page({ hidden: true }))).toBe(false);
  });
});
