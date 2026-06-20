/**
 * 스크린리더 announce 싱글톤 — 동적 액션 결과(홈 편집 토글/순서변경/리셋 등)를 음성으로 전달.
 *
 * 코드베이스에 범용 aria-live 채널이 없어(기존 5곳 전부 컴포넌트 스코프) 신설.
 * polite live region을 body에 1회 부착하고, textContent를 비웠다가 rAF 후 set해 동일 문자열도 재낭독.
 * 메시지는 koreanJosa로 조사 처리(feedback_korean_josa SSOT). WCAG 4.1.3.
 */

let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (region && document.body.contains(region)) return region;
  region = document.createElement('div');
  region.id = 'solb-a11y-announcer';
  region.className = 'sr-only'; // Tailwind 빌트인 — 시각 숨김, SR 노출
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);
  return region;
}

export function announce(message: string): void {
  const el = ensureRegion();
  if (!el) return;
  el.textContent = '';
  // 같은 문자열 재낭독 위해 다음 프레임에 set(즉시 set은 변화 없음으로 SR이 무시).
  requestAnimationFrame(() => {
    if (region) region.textContent = message;
  });
}
