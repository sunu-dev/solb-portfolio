import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ComponentProps, type ReactElement } from 'react';
import type { EconomicKind } from '@/lib/economicEvents';

// The project uses Node tests. Retain component state/effects without adding a DOM dependency.
const hooks = vi.hoisted(() => {
  type Effect = { kind: 'effect'; deps: unknown[]; cleanup?: () => void };
  type Scope = { slots: unknown[]; pending: (() => void)[]; cursor: number };
  let current: Scope;
  const scopes: Scope[] = [];
  return {
    create() { const scope = { slots: [], pending: [], cursor: 0 }; scopes.push(scope); return scope; },
    render<T>(scope: Scope, callback: () => T): T {
      current = scope; scope.cursor = 0;
      const result = callback();
      scope.pending.splice(0).forEach(effect => effect());
      return result;
    },
    unmount(scope: Scope) {
      scope.slots.forEach(slot => { if ((slot as Effect)?.kind === 'effect') (slot as Effect).cleanup?.(); });
      scope.slots = [];
    },
    reset() { scopes.splice(0).forEach(scope => this.unmount(scope)); },
    useRef(value: unknown) { return current.slots[current.cursor++] ??= { current: value }; },
    useState(initial: unknown) {
      const scope = current, index = scope.cursor++;
      const slot = (scope.slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }) as { value: unknown };
      return [slot.value, (next: unknown) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useEffect(setup: () => void | (() => void), deps: unknown[]) {
      const scope = current, index = scope.cursor++;
      const previous = scope.slots[index] as Effect | undefined;
      if (previous && deps.length === previous.deps.length && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
      scope.pending.push(() => {
        previous?.cleanup?.();
        scope.slots[index] = { kind: 'effect', deps, cleanup: setup() || undefined };
      });
    },
  };
});
const notebook = vi.hoisted(() => ({ ready: true, save: vi.fn(), notebook: { version: 1, entries: {} } }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.useEffect }));
vi.mock('@/hooks/useGuideNotebook', async original => ({ ...await original<typeof import('@/hooks/useGuideNotebook')>(), useGuideNotebook: () => notebook }));
vi.mock('@/hooks/useEconomicEvents', () => ({ useEconomicEvents: () => ({ data: undefined, retry: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/tourTelemetry', () => ({ logGuideEvent: vi.fn() }));
vi.mock('@/store/portfolioStore', () => ({ usePortfolioStore: (selector: (state: unknown) => unknown) => selector({ stocks: { investing: [], watching: [] } }) }));
vi.mock('@/components/economy/EconomicHighlights', () => ({ default: () => null, openEconomicCalendar: vi.fn() }));
vi.mock('@/components/portfolio/ConversationalTimeline', () => ({ default: () => null }));

import MarketGuide, { type MarketGuideRequest } from '@/components/insights/MarketGuide';
import InsightsSection from '@/components/insights/InsightsSection';
import { ImpactPath } from '@/components/economy/EventLearning';
import { logGuideEvent } from '@/lib/tourTelemetry';
import { MARKET_GUIDES } from '@/config/marketGuides';
import { guideDraftSession } from '@/lib/guideDraftSession';

type Props = { children?: unknown; id?: string; value?: string; onClick?: () => void; onChange?: (event: { target: { value: string } }) => void; guide?: unknown };
function elements(node: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function content(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(content).join('');
  return isValidElement<Props>(node) ? content(node.props.children) : '';
}
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
const focus = vi.fn(), scrollIntoView = vi.fn();
function flushFrames() {
  const pending = [...frames.values()]; frames.clear();
  pending.forEach(callback => callback(0));
}
function report() {
  const scope = hooks.create();
  let lessonScope = hooks.create(), lessonKey: string | null = null;
  return {
    unmount() { hooks.unmount(scope); hooks.unmount(lessonScope); },
    render(request?: MarketGuideRequest) {
      const child = elements(InsightsSection({ guideRequest: request })).find(node => node.type === MarketGuide)! as ReactElement<ComponentProps<typeof MarketGuide>>;
      const tree = hooks.render(scope, () => MarketGuide(child.props));
      const lesson = elements(tree).find(node => typeof node.type === 'function' && node.props.guide);
      if (lesson?.key !== lessonKey) {
        hooks.unmount(lessonScope); lessonScope = hooks.create(); lessonKey = lesson?.key ?? null;
      }
      const body = lesson ? hooks.render(lessonScope, () => (lesson.type as (props: Props) => unknown)(lesson.props)) : null;
      const textarea = elements(body).find(node => node.type === 'textarea');
      return { tree, textarea, back: elements(tree).find(node => node.type === 'button' && content(node) === '리포트로 돌아가기') };
    },
  };
}
function calendarRequest(kind: EconomicKind, key: number): MarketGuideRequest {
  let request: MarketGuideRequest | undefined;
  window.addEventListener('open-market-guide', event => { request = { ...(event as CustomEvent<{ id: MarketGuideRequest['id'] }>).detail, key }; }, { once: true });
  const path = hooks.render(hooks.create(), () => ImpactPath({ kind }));
  elements(path).find(node => node.type === 'button' && /과정 보기|연결 보기/.test(content(node)))!.props.onClick!();
  return request!;
}

beforeEach(() => {
  guideDraftSession.clear();
  vi.clearAllMocks(); notebook.ready = true; notebook.notebook.entries = {};
  frames.clear(); frameId = 0;
  let location = new URL('https://joobi.kr/?view=insights');
  vi.stubGlobal('window', Object.assign(new EventTarget(), {
    get location() { return location; },
    history: { pushState: vi.fn((_state: unknown, _unused: string, path: string) => {
      location = new URL(path, location);
      window.location = location as unknown as Location;
    }) },
  }));
  vi.stubGlobal('document', { getElementById: vi.fn(() => ({ focus, scrollIntoView })) });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => { hooks.reset(); vi.unstubAllGlobals(); });

describe('report navigation keeps unsaved guide notes', () => {
  it('preserves a draft and restores heading focus when an event reopens the same guide', () => {
    const mounted = report();
    const first = calendarRequest('fomc', 1);
    mounted.render(first).textarea!.props.onChange!({ target: { value: '다음 금리 발표에서 확인할 것' } });
    flushFrames();
    const returned = mounted.render(calendarRequest('fomc', 2));
    flushFrames();
    expect(returned.textarea!.props.value).toBe('다음 금리 발표에서 확인할 것');
    expect(focus).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(vi.mocked(logGuideEvent).mock.calls).toEqual([['open', 'rates'], ['open', 'rates']]);
    expect(notebook.save).not.toHaveBeenCalled();
  });

  it('keeps separate drafts when real event explanations switch between guides', () => {
    const mounted = report();
    mounted.render(calendarRequest('fomc', 1)).textarea!.props.onChange!({ target: { value: '금리 메모' } });
    mounted.render(calendarRequest('cpi', 2)).textarea!.props.onChange!({ target: { value: '물가 메모' } });
    expect(mounted.render(calendarRequest('fomc', 3)).textarea!.props.value).toBe('금리 메모');
    expect(mounted.render(calendarRequest('pce', 4)).textarea!.props.value).toBe('물가 메모');
  });

  it('lets local back/topic navigation override a consumed request until the next request', () => {
    const mounted = report(), first = calendarRequest('fomc', 1);
    mounted.render(first).back!.props.onClick!();
    const overview = mounted.render(first);
    expect(overview.textarea).toBeUndefined();
    elements(overview.tree).find(node => node.props.id === 'guide-earnings')!.props.onClick!();
    const local = mounted.render(first);
    expect(content(local.tree)).toContain(MARKET_GUIDES.find(guide => guide.id === 'earnings')!.title);
    const reopened = mounted.render(calendarRequest('fomc', 2));
    expect(content(reopened.tree)).toContain('금리');
    expect(reopened.textarea).toBeDefined();
  });

  it('keeps the topic URL and browser Back in agreement without losing a draft', () => {
    const mounted = report();
    elements(mounted.render().tree).find(node => node.props.id === 'guide-rates')!.props.onClick!();
    expect(window.location.search).toContain('guide=rates');
    mounted.render().textarea!.props.onChange!({ target: { value: '돌아와서 이어 쓸 메모' } });
    window.history.pushState(null, '', '/?view=insights');
    window.dispatchEvent(new Event('popstate'));
    expect(mounted.render().textarea).toBeUndefined();
    window.history.pushState(null, '', '/?view=insights&guide=rates');
    window.dispatchEvent(new Event('popstate'));
    expect(mounted.render().textarea!.props.value).toBe('돌아와서 이어 쓸 메모');
    mounted.render().back!.props.onClick!();
    expect(window.location.search).not.toContain('guide=');
  });

  it('waits for notebook restoration and focuses only the newest requested explanation', () => {
    notebook.ready = false;
    const mounted = report();
    expect(mounted.render(calendarRequest('fomc', 1)).textarea).toBeUndefined();
    const latest = calendarRequest('cpi', 2);
    expect(mounted.render(latest).textarea).toBeUndefined();
    flushFrames();
    expect(focus).not.toHaveBeenCalled();
    notebook.ready = true;
    expect(mounted.render(latest).textarea).toBeDefined();
    flushFrames();
    expect(vi.mocked(logGuideEvent).mock.calls).toEqual([['open', 'inflation']]);
    expect(focus).toHaveBeenCalledOnce();
  });

  it('retains a draft after a different upper menu unmounts the report', () => {
    const request = calendarRequest('fomc', 1), mounted = report();
    mounted.render(request).textarea!.props.onChange!({ target: { value: '다른 메뉴를 다녀와도 유지할 초안' } });
    mounted.unmount();
    expect(report().render(request).textarea!.props.value).toBe('다른 메뉴를 다녀와도 유지할 초안');
    expect(notebook.save).not.toHaveBeenCalled();
  });

  it('clears a draft when logout happens while the report is unmounted', () => {
    const request = calendarRequest('fomc', 1), mounted = report();
    mounted.render(request).textarea!.props.onChange!({ target: { value: '이전 계정의 초안' } });
    mounted.unmount();
    window.dispatchEvent(new Event('solb-user-storage-clearing'));
    expect(report().render(request).textarea!.props.value).toBe('');
  });

  it('returns focus to the real report action that opened an explanation', () => {
    const mounted = report();
    mounted.render();
    window.dispatchEvent(new CustomEvent('open-market-guide', { detail: { id: 'rates', returnFocusId: 'report-guide-rates' } }));
    const request: MarketGuideRequest = { id: 'rates', key: 1 };
    mounted.render(request); flushFrames();
    mounted.render(request).back!.props.onClick!();
    mounted.render(request); flushFrames();
    expect(document.getElementById).toHaveBeenLastCalledWith('report-guide-rates');
  });
});
