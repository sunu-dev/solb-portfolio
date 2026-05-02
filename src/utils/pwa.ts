/**
 * PWA 환경 감지 — 정책 SSOT: docs/NOTIFICATION_POLICY.md §7
 *
 * iOS Safari는 PWA 설치 시에만 web push 작동.
 * Android Chrome은 beforeinstallprompt 이벤트로 자동 프롬프트.
 * 데스크탑은 Chrome 주소창의 설치 아이콘 사용.
 */

/** 이미 PWA로 설치되어 standalone 모드로 실행 중인가 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari
  if ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone) return true;
  // 기타 브라우저
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

/** iOS Safari 감지 — Web Push가 PWA 설치 후에만 작동하는 환경 */
export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

/** Android 또는 데스크탑 Chrome — beforeinstallprompt 지원 환경 */
export function supportsBeforeInstallPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  return 'BeforeInstallPromptEvent' in window || /Android/.test(navigator.userAgent);
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
