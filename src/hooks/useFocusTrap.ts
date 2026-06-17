import { useEffect, type RefObject } from 'react';

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
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const prevFocused = document.activeElement as HTMLElement | null;
    const SELECTOR =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // 마운트 시 첫 포커서블로 이동(없으면 컨테이너 자체)
    const first = focusables()[0];
    if (first) first.focus();
    else container.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === firstEl || !container.contains(activeEl))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // 트리거로 포커스 복원(존재·연결돼 있을 때만)
      if (prevFocused && typeof prevFocused.focus === 'function' && document.contains(prevFocused)) {
        prevFocused.focus();
      }
    };
  }, [active, containerRef, onEscape]);
}
