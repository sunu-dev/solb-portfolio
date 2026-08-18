import { isOcrProviderEnabled } from '@/lib/ocrAvailability';

export type AiSafetyLevel = 'good' | 'warning' | 'danger';

export interface AiSafetyCheck {
  id: string;
  label: string;
  value: string;
  level: AiSafetyLevel;
  detail: string;
}

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function getAiSafetyStatus(env: Record<string, string | undefined> = process.env) {
  const totalDaily = positiveInt(env.AI_DAILY_LIMIT_TOTAL, 250);
  const analysisFree = positiveInt(env.ANALYSIS_DAILY_FREE, 3);
  const chokFree = positiveInt(env.CHOK_DAILY_FREE, 1);
  const ocrUser = positiveInt(env.OCR_DAILY_LIMIT_USER, 5);
  const ocrEnabled = isOcrProviderEnabled(env);
  const monthlyBudget = Number(env.AI_MONTHLY_BUDGET_USD || 0);
  const stopRatio = Number(env.AI_MONTHLY_BUDGET_STOP_RATIO || 0.95);
  const claudeEnabled = env.ENABLE_CLAUDE_FALLBACK === 'true';
  const auditRate = Number(env.AI_AUDIT_SAMPLE_RATE || 0);

  const checks: AiSafetyCheck[] = [
    {
      id: 'daily-total', label: '전체 일일 하드캡', value: `${totalDaily}회/일`,
      level: totalDaily <= 0 ? 'danger' : totalDaily > 1000 ? 'warning' : 'good',
      detail: 'AI 분석, AI 촉, 이미지 인식의 전체 호출량을 함께 제한해요.',
    },
    {
      id: 'free-user', label: '무료 사용자 하드캡', value: `분석 ${analysisFree} · 촉 ${chokFree}회/일`,
      level: analysisFree <= 5 && chokFree <= 2 ? 'good' : 'warning',
      detail: '무료 베타 권장 범위는 분석 5회 이하, 촉 2회 이하예요.',
    },
    {
      id: 'ocr-user', label: '이미지 인식', value: ocrEnabled
        ? `로그인 ${ocrUser}회/일 · 비로그인 차단`
        : '비활성 · 외부 이미지 전송 차단',
      level: ocrEnabled && ocrUser > 5 ? 'warning' : 'good',
      detail: ocrEnabled
        ? '유료 Gemini 서비스 확인과 로그인 인증을 모두 통과해야 OCR을 호출할 수 있어요.'
        : '무료 Gemini 서비스에서는 증권사 스크린샷을 외부 AI로 전송하지 않아요.',
    },
    {
      id: 'monthly-budget', label: '월 비용 하드캡',
      value: monthlyBudget > 0 ? `$${monthlyBudget.toFixed(2)} · ${Math.round(stopRatio * 100)}% 정지` : '미설정',
      level: monthlyBudget > 0 && stopRatio >= 0.5 && stopRatio <= 1 ? 'good' : 'warning',
      detail: monthlyBudget > 0 ? '동시 호출 여유를 위해 설정 비율에서 미리 정지해요.' : 'AI_MONTHLY_BUDGET_USD를 설정해야 월 비용을 자동 차단해요.',
    },
    {
      id: 'claude-fallback', label: 'Claude 유료 fallback', value: claudeEnabled ? '활성' : '비활성',
      level: claudeEnabled ? 'warning' : 'good',
      detail: claudeEnabled ? 'Gemini 장애 시 유료 Claude 호출이 발생할 수 있어요.' : '명시적으로 켜기 전에는 Claude 비용이 발생하지 않아요.',
    },
    {
      id: 'audit-sampling', label: 'AI 출력 표본', value: `${Math.max(0, auditRate * 100).toFixed(1)}%`,
      level: auditRate > 0.1 ? 'warning' : 'good',
      detail: auditRate > 0.1 ? '로컬 시험이 아니라면 표본율을 10% 이하로 낮추는 편이 좋아요.' : '기본 비활성 또는 소량 표본 상태예요.',
    },
  ];

  return {
    overall: checks.some(check => check.level === 'danger') ? 'danger'
      : checks.some(check => check.level === 'warning') ? 'warning'
        : 'good',
    checks,
  };
}
