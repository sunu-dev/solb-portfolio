import { PRO_TOOL_FEATURES, type ProToolFeatureId } from '@/config/proPlan';
import type { UserTier } from '@/lib/userTier';

export type ProEntitlements = Readonly<Record<ProToolFeatureId, boolean>>;

const FREE_ENTITLEMENTS: ProEntitlements = Object.freeze({
  advanced_portfolio_export: false,
  backup_versions: false,
  extended_history: false,
  bulk_ocr_import: false,
  dashboard_presets: false,
  ad_free: false,
});

const PAID_TOOL_ENTITLEMENTS: ProEntitlements = Object.freeze(
  Object.fromEntries(PRO_TOOL_FEATURES.map((feature) => [feature.id, true])) as Record<ProToolFeatureId, boolean>,
);

export function resolveProEntitlements(tier: UserTier): ProEntitlements {
  return tier === 'pro' ? PAID_TOOL_ENTITLEMENTS : FREE_ENTITLEMENTS;
}

export function hasProToolEntitlement(tier: UserTier, feature: ProToolFeatureId): boolean {
  return resolveProEntitlements(tier)[feature];
}
