/**
 * OCR 공개 UI 플래그.
 *
 * 무료 Gemini 서비스에는 개인정보가 포함될 수 있는 증권사 화면을 전송하지 않는다.
 * 유료 AI 처리 환경을 확인한 뒤 Vercel에서 명시적으로 true로 설정하고 재배포해야 한다.
 */
export const OCR_UI_ENABLED = process.env.NEXT_PUBLIC_OCR_ENABLED === 'true';

export const OCR_DISABLED_COPY = {
  title: '스크린샷 가져오기는 준비 중이에요.',
  detail: '개인정보 보호 기준을 충족한 AI 처리 환경을 준비하고 있어요. 지금은 종목을 직접 추가해주세요.',
} as const;
