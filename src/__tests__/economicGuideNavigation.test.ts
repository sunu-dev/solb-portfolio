import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import type { EconomicKind } from '@/lib/economicEvents';

const hooks = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)> }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, vi.fn()],
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
  useCallback: (callback: unknown) => callback,
}));
vi.mock('@/hooks/useEconomicEvents', () => ({ useEconomicEvents: () => ({ data: undefined, symbols: [], retry: vi.fn() }) }));
vi.mock('@/components/economy/EconomicHighlights', () => ({ EventExplanation: () => null }));
vi.mock('@/components/portfolio/MorningBriefing', () => ({ default: () => null }));

import { ImpactPath } from '@/components/economy/EventLearning';
import EconomicCalendar from '@/components/economy/EconomicCalendar';
import BriefingDialog from '@/components/portfolio/BriefingDialog';

type ElementProps = { children?: unknown; onClick?: () => void; ref?: { current: unknown } };
const cleanups: Array<() => void> = [];
function elements(node: unknown): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function content(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(content).join('');
  return isValidElement<ElementProps>(node) ? content(node.props.children) : '';
}
function guideButton(kind: EconomicKind) {
  return elements(ImpactPath({ kind })).find(node => node.type === 'button' && /과정 보기|연결 보기/.test(content(node)));
}
function mountDialogs() {
  const calendar = EconomicCalendar();
  const briefing = BriefingDialog({ ready: false });
  const attach = (element: ReactElement) => {
    const dialog = { open: true, close: vi.fn() };
    dialog.close.mockImplementation(() => { dialog.open = false; });
    (element.props as ElementProps).ref!.current = dialog;
    return dialog;
  };
  const dialogs = [attach(calendar), attach(briefing)];
  hooks.effects.splice(0).forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
  return dialogs;
}

beforeEach(() => { hooks.effects.length = 0; vi.stubGlobal('window', new EventTarget()); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

describe('economic explanation to market guide navigation', () => {
  it.each([
    ['fomc', 'rates'], ['cpi', 'inflation'], ['pce', 'inflation'], ['earnings', 'earnings'],
  ] as const)('opens %s explanation in the %s guide after clearing both dialogs', (kind, guideId) => {
    const dialogs = mountDialogs();
    const received: unknown[] = [];
    window.addEventListener('open-market-guide', event => { received.push((event as CustomEvent).detail); });
    guideButton(kind)!.props.onClick!();
    expect(received).toEqual([{ id: guideId }]);
    for (const dialog of dialogs) {
      expect(dialog.close).toHaveBeenCalledOnce();
      expect(dialog.open).toBe(false);
    }
  });

  it.each(['bok', 'jobs', 'holiday'] as const)('does not suggest an unsupported guide for %s', kind => {
    expect(guideButton(kind)).toBeUndefined();
  });

  it('does not dismiss dialogs for invalid guide requests and removes navigation listeners on unmount', () => {
    const dialogs = mountDialogs();
    window.dispatchEvent(new CustomEvent('open-market-guide', { detail: { id: 'unknown' } }));
    for (const dialog of dialogs) expect(dialog.close).not.toHaveBeenCalled();
    cleanups.splice(0).forEach(cleanup => cleanup());
    window.dispatchEvent(new CustomEvent('open-market-guide', { detail: { id: 'rates' } }));
    for (const dialog of dialogs) expect(dialog.close).not.toHaveBeenCalled();
  });
});
