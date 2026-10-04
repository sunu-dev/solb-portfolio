import { useEffect, useRef, type RefObject } from 'react';

const activeTraps: symbol[] = [];

/**
 * 모달 접근성 — 포커스 트랩 + ESC 닫기 + 포커스 복원.
 *
 * role="dialog"/aria-modal="true"를 선언한 컨테이너에 실제 모달 동작을 부여한다.
 * (선언만 하고 동작이 없으면 '거짓 aria-modal' — WCAG 위반. 토스 PC 비교 UI/UX 리뷰 배치 2.)
 *
 * - active=true가 되면: 컨테이너 첫 포커서블로 포커스 이동, Tab/Shift+Tab을 내부 순환 트랩.
 * - ESC: onEscape 콜백(보통 close) 호출.
 * - active=false(언마운트 포함): 직전에 포커스됐던 트리거로 복원.
 *
 * @param active 트랩 활성 여부(모달 열림)
 * @param containerRef role="dialog" 컨테이너 ref
 * @param onEscape ESC 시 호출(없으면 ESC 무시)
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onEscape?: () => void,
) {
  const escapeRef = useRef(onEscape);
  useEffect(() => { escapeRef.current = onEscape; }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const prevFocused = document.activeElement as HTMLElement | null;
    const token = Symbol('focus-trap');
    activeTraps.push(token);
    const SELECTOR =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (el) => el.getClientRects().length > 0 && !el.closest('[inert]'),
      );

    // 마운트 시 첫 포커서블로 이동(없으면 컨테이너 자체)
    const first = container.querySelector<HTMLElement>('[data-dialog-initial-focus]') ?? focusables()[0];
    if (!container.contains(document.activeElement)) {
      (first ?? container).focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (activeTraps.at(-1) !== token) return;
      if (e.key !== 'Tab' && e.key !== 'Escape') return;
      // A native modal (for example login) owns keyboard navigation above this
      // custom dialog. A custom trap inside that modal may still handle its keys.
      const nativeModal = document.activeElement?.closest('dialog:modal')
        ?? document.querySelector('dialog:modal');
      if (nativeModal && !nativeModal.contains(container)) return;
      if (e.key === 'Escape' && escapeRef.current) {
        e.preventDefault();
        e.stopPropagation();
        escapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      // Safari may skip buttons in native Tab navigation and jump to browser chrome.
      // Move explicitly for every Tab, rather than only handling the two boundaries.
      const index = list.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? (index <= 0 ? list.length - 1 : index - 1)
        : (index < 0 || index === list.length - 1 ? 0 : index + 1);
      e.preventDefault();
      list[next].focus();
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const wasTop = activeTraps.at(-1) === token;
      activeTraps.splice(activeTraps.indexOf(token), 1);
      // 트리거로 포커스 복원(존재·연결돼 있을 때만)
      if (wasTop && prevFocused && typeof prevFocused.focus === 'function' && document.contains(prevFocused)
        && (document.activeElement === document.body || container.contains(document.activeElement))) {
        prevFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef]);
}
