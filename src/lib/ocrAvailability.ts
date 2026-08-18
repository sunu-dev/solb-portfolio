/**
 * OCR 서버 실행 조건.
 *
 * 공개 UI 플래그와 유료 Gemini 서비스 확인 플래그가 모두 true일 때만
 * 이미지를 외부 AI로 전송한다. 어느 한 값이라도 없거나 오타가 나면 닫힌다.
 */
export function isOcrProviderEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NEXT_PUBLIC_OCR_ENABLED === 'true'
    && env.GEMINI_PAID_SERVICE === 'true';
}
