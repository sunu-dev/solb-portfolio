import type { AiAuditFeature } from '@/lib/aiOutputAudit';

export interface AiAuditCoverage {
  feature: AiAuditFeature;
  label: string;
  target: number;
  total: number;
  reviewed: number;
  remaining: number;
  progressPercent: number;
  ready: boolean;
}

const LABELS: Record<AiAuditFeature, string> = {
  'ai-analysis': 'AI 분석',
  'ai-chok': 'AI 촉',
};

export function buildAiAuditCoverage(
  rows: Array<{ feature: string; reviewed_at: string | null }>,
  targetPerFeature: number,
): AiAuditCoverage[] {
  const target = Number.isFinite(targetPerFeature) && targetPerFeature > 0
    ? Math.floor(targetPerFeature)
    : 100;

  return (Object.keys(LABELS) as AiAuditFeature[]).map(feature => {
    const featureRows = rows.filter(row => row.feature === feature);
    const total = featureRows.length;
    const reviewed = featureRows.filter(row => row.reviewed_at).length;
    return {
      feature,
      label: LABELS[feature],
      target,
      total,
      reviewed,
      remaining: Math.max(0, target - total),
      progressPercent: Math.min(100, Math.round(total / target * 1000) / 10),
      ready: total >= target,
    };
  });
}
