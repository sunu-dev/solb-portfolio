import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Small effect runner lets us exercise the actual hooks in the project's Node test environment.
const hooks = vi.hoisted(() => {
  type Effect = { deps: unknown[]; cleanup?: () => void };
  type Scope = { slots: unknown[]; pending: (() => void)[]; cursor: number };
  let current: Scope;
  const scopes: Scope[] = [];
  return {
    create() { const scope = { slots: [], pending: [], cursor: 0 }; scopes.push(scope); return scope; },
    render(scope: Scope, callback: () => void) {
      current = scope; scope.cursor = 0; callback();
      scope.pending.splice(0).forEach(effect => effect());
    },
    unmount(scope: Scope) { scope.slots.forEach(slot => (slot as Effect)?.cleanup?.()); scope.slots = []; },
    reset() { scopes.splice(0).reverse().forEach(scope => this.unmount(scope)); },
    useRef(value: unknown) { const index = current.cursor++; return current.slots[index] ??= { current: value }; },
    useEffect(callback: () => void | (() => void), deps: unknown[]) {
      const scope = current; const index = scope.cursor++;
      const old = scope.slots[index] as Effect | undefined;
      if (old && deps.length === old.deps.length && deps.every((dep, i) => Object.is(dep, old.deps[i]))) return;
      scope.pending.push(() => { old?.cleanup?.(); scope.slots[index] = { deps, cleanup: callback() }; });
    },
  };
});
vi.mock('react', () => ({ useRef: hooks.useRef, useEffect: hooks.useEffect }));

import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useModalViewport } from '@/hooks/useModalViewport';
import { lockBodyScroll } from '@/lib/bodyScrollLock';

class TestElement {
  children: TestElement[] = [];
  isConnected = true;
  visible = true;
  nativeModal: TestElement | null = null;
  style = { position: '', top: '', width: '', overflow: '', setProperty: vi.fn(), removeProperty: vi.fn() };
  focus = vi.fn((options?: FocusOptions) => { void options; doc.activeElement = this; });
  contains(element: unknown): boolean { return this === element || this.children.some(child => child.contains(element)); }
  querySelectorAll() { return this.children; }
  querySelector() { return null; }
  getClientRects() { return this.visible ? [{}] : []; }
  closest(selector: string) { return selector === 'dialog:modal' ? this.nativeModal : null; }
}
let doc: { body: TestElement; activeElement: TestElement; contains: (el: TestElement) => boolean; querySelector: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
let handlers: Set<(event: KeyboardEvent) => void>;
const ref = (element: TestElement) => ({ current: element as unknown as HTMLElement });
const key = (value: string, shiftKey = false) => {
  const event = { key: value, shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  [...handlers].forEach(handler => handler(event as unknown as KeyboardEvent));
  return event;
};

beforeEach(() => {
  const body = new TestElement(); handlers = new Set();
  doc = { body, activeElement: body, contains: element => element.isConnected,
    querySelector: vi.fn(() => null),
    addEventListener: vi.fn((_type, handler) => handlers.add(handler)),
    removeEventListener: vi.fn((_type, handler) => handlers.delete(handler)),
  };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', { scrollY: 420, innerHeight: 844, scrollTo: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { hooks.reset(); vi.unstubAllGlobals(); });

describe('dialog focus', () => {
  it('keeps typing focus across rerenders while using the latest close callback', () => {
    const panel = new TestElement(); const close = new TestElement(); const input = new TestElement();
    panel.children = [close, input]; const panelRef = ref(panel); const scope = hooks.create();
    const oldClose = vi.fn(); const latestClose = vi.fn();
    hooks.render(scope, () => useFocusTrap(true, panelRef, oldClose));
    input.focus();
    hooks.render(scope, () => useFocusTrap(true, panelRef, latestClose));
    expect(doc.activeElement).toBe(input);
    expect(close.focus).toHaveBeenCalledTimes(1);
    key('Escape'); expect(latestClose).toHaveBeenCalledOnce(); expect(oldClose).not.toHaveBeenCalled();
  });
  it('preserves an already focused input and wraps forward and reverse tab navigation', () => {
    const panel = new TestElement(); const first = new TestElement(); const last = new TestElement();
    panel.children = [first, last]; last.focus(); const scope = hooks.create();
    hooks.render(scope, () => useFocusTrap(true, ref(panel)));
    expect(last.focus).toHaveBeenCalledTimes(1);
    expect(key('Tab').preventDefault).toHaveBeenCalledOnce(); expect(doc.activeElement).toBe(first);
    key('Tab', true); expect(doc.activeElement).toBe(last);
    doc.activeElement = doc.body; key('Tab'); expect(doc.activeElement).toBe(first);
  });
  it('only dismisses the top dialog and restores focus without scrolling', () => {
    const trigger = new TestElement(); trigger.focus();
    const parent = new TestElement(); const childTrigger = new TestElement(); parent.children = [childTrigger];
    const child = new TestElement(); child.children = [new TestElement()];
    const parentClose = vi.fn(); const childClose = vi.fn();
    hooks.render(hooks.create(), () => useFocusTrap(true, ref(parent), parentClose));
    const childScope = hooks.create(); hooks.render(childScope, () => useFocusTrap(true, ref(child), childClose));
    key('Escape'); expect(childClose).toHaveBeenCalledOnce(); expect(parentClose).not.toHaveBeenCalled();
    hooks.unmount(childScope); expect(doc.activeElement).toBe(childTrigger);
    expect(childTrigger.focus).toHaveBeenLastCalledWith({ preventScroll: true });
    key('Escape'); expect(parentClose).toHaveBeenCalledOnce();
  });
  it('moves between controls explicitly so Safari cannot skip them and focus the address bar', () => {
    const panel = new TestElement(); const input = new TestElement(); const button = new TestElement(); const last = new TestElement();
    panel.children = [input, button, last]; hooks.render(hooks.create(), () => useFocusTrap(true, ref(panel)));
    expect(key('Tab').preventDefault).toHaveBeenCalledOnce(); expect(doc.activeElement).toBe(button);
    key('Tab'); expect(doc.activeElement).toBe(last);
    key('Tab', true); expect(doc.activeElement).toBe(button);
  });
  it('does not steal focus from a new dialog during close', () => {
    const trigger = new TestElement(); trigger.focus(); const panel = new TestElement();
    panel.children = [new TestElement()]; const scope = hooks.create();
    hooks.render(scope, () => useFocusTrap(true, ref(panel)));
    const nextInput = new TestElement(); nextInput.focus(); hooks.unmount(scope);
    expect(doc.activeElement).toBe(nextInput);
  });
  it('leaves Tab and Escape to a native modal above the custom dialog, then resumes when it closes', () => {
    const panel = new TestElement(); const first = new TestElement(); const last = new TestElement();
    panel.children = [first, last]; const close = vi.fn();
    hooks.render(hooks.create(), () => useFocusTrap(true, ref(panel), close));
    const login = new TestElement(); const loginButton = new TestElement();
    login.children = [loginButton]; loginButton.nativeModal = login;
    doc.querySelector.mockReturnValue(login); loginButton.focus();

    for (const event of [key('Tab'), key('Tab', true), key('Escape')]) {
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(event.stopPropagation).not.toHaveBeenCalled();
    }
    expect(close).not.toHaveBeenCalled();
    expect(doc.activeElement).toBe(loginButton);

    doc.querySelector.mockReturnValue(null); first.focus();
    expect(key('Tab').preventDefault).toHaveBeenCalledOnce();
    expect(doc.activeElement).toBe(last);
    key('Escape'); expect(close).toHaveBeenCalledOnce();
  });
  it('preserves a custom trap inside the active native modal even when another native modal is behind it', () => {
    const backgroundModal = new TestElement(); const activeModal = new TestElement();
    const panel = new TestElement(); const first = new TestElement(); const last = new TestElement();
    panel.children = [first, last]; activeModal.children = [panel];
    first.nativeModal = activeModal; last.nativeModal = activeModal;
    doc.querySelector.mockReturnValue(backgroundModal); first.focus();
    const close = vi.fn();
    hooks.render(hooks.create(), () => useFocusTrap(true, ref(panel), close));

    expect(key('Tab').preventDefault).toHaveBeenCalledOnce();
    expect(doc.activeElement).toBe(last);
    key('Escape'); expect(close).toHaveBeenCalledOnce();
  });
  it('traps Tab even when no visible controls exist', () => {
    const panel = new TestElement(); const hidden = new TestElement(); hidden.visible = false;
    panel.children = [hidden]; hooks.render(hooks.create(), () => useFocusTrap(true, ref(panel)));
    expect(key('Tab').preventDefault).toHaveBeenCalledOnce(); expect(doc.activeElement).toBe(panel);
  });
});

describe('keyboard and nested scroll locks', () => {
  it('keeps the page locked until the last dialog closes, preserving prior styles and scroll', () => {
    doc.body.style.position = 'relative'; doc.body.style.width = '90%';
    const releaseParent = lockBodyScroll(); const releaseChild = lockBodyScroll();
    expect(doc.body.style.top).toBe('-420px'); releaseParent(); releaseParent();
    expect(doc.body.style.position).toBe('fixed'); expect(window.scrollTo).not.toHaveBeenCalled();
    releaseChild(); expect(doc.body.style.position).toBe('relative'); expect(doc.body.style.width).toBe('90%');
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 420, behavior: 'instant' });
  });
  it('follows keyboard height and offset, coalescing updates and cleaning up listeners', () => {
    const viewport = new EventTarget(); Object.assign(viewport, { height: 844, offsetTop: 0 });
    Object.assign(window, { visualViewport: viewport });
    const frames = new Map<number, FrameRequestCallback>(); let id = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame));
    const panel = new TestElement(); const scope = hooks.create();
    hooks.render(scope, () => useModalViewport(true, ref(panel)));
    Object.assign(viewport, { height: 400, offsetTop: 40 });
    viewport.dispatchEvent(new Event('resize')); viewport.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(1); frames.forEach(callback => callback(0)); frames.clear();
    expect(panel.style.setProperty).toHaveBeenCalledWith('--modal-viewport-height', '400px');
    expect(panel.style.setProperty).toHaveBeenCalledWith('--modal-viewport-bottom', '404px');
    hooks.unmount(scope); viewport.dispatchEvent(new Event('resize')); expect(frames.size).toBe(0);
    expect(doc.body.style.position).toBe('');
  });
});
