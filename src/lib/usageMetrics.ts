export const USAGE_FEATURES = ['portfolio', 'analysis', 'chart', 'news', 'fundamentals', 'assistant', 'learning', 'company', 'insights', 'other'] as const;
export type UsageFeature = typeof USAGE_FEATURES[number];
export const USAGE_LABELS: Record<UsageFeature, string> = {
  portfolio: '내 투자', analysis: '종목 탐색', chart: '차트', news: '뉴스', fundamentals: '기업 지표',
  assistant: '주비 노트', learning: '배우기', company: '기업·산업 설명', insights: '시장 해설', other: '기타',
};
export const USAGE_EVENTS = ['view', 'explore_step', 'related_company'] as const;
export type UsageEvent = typeof USAGE_EVENTS[number];
export interface UsageSample {
  id: string; session_id: string; started_at: string; ended_at: string;
  active_ms: number; feature: UsageFeature; event: UsageEvent | null;
}
export interface UsageRow extends UsageSample { user_id: string | null; visitor_id: string | null }
export const kstDay = (time: string | number) => new Date(new Date(time).getTime() + 9 * 3600000).toISOString().slice(0, 10);
export const shiftDay = (day: string, offset: number) => new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);

/** Only completed target days qualify; activity on signup day is never a return. */
export function retention(users: { user_id: string; created_at: string }[], active: Map<string, Set<string>>, today: string, lag: number) {
  const first = shiftDay(today, -lag - 7);
  const last = shiftDay(today, -lag - 1);
  const cohort = users.filter(u => { const day = kstDay(u.created_at); return day >= first && day <= last; });
  const returned = cohort.filter(u => active.get(shiftDay(kstDay(u.created_at), lag))?.has(u.user_id)).length;
  return { eligible: cohort.length, returned, rate: cohort.length ? Math.round(returned / cohort.length * 100) : null };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseUsagePayload(body: unknown, now = Date.now()): { visitorId: string; samples: UsageSample[] } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.visitorId !== 'string' || !uuid.test(b.visitorId) || !Array.isArray(b.samples) || !b.samples.length || b.samples.length > 20) return null;
  const samples: UsageSample[] = [];
  for (const value of b.samples) {
    if (!value || typeof value !== 'object') return null;
    const s = value as Record<string, unknown>;
    if (typeof s.id !== 'string' || !uuid.test(s.id) || typeof s.session_id !== 'string' || !uuid.test(s.session_id)
      || typeof s.started_at !== 'string' || typeof s.ended_at !== 'string'
      || !USAGE_FEATURES.includes(s.feature as UsageFeature)
      || (s.event !== null && !USAGE_EVENTS.includes(s.event as UsageEvent))) return null;
    const start = Date.parse(s.started_at), end = Date.parse(s.ended_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < now - 600000 || end > now + 30000 || end < start || end - start > 60000
      || typeof s.active_ms !== 'number' || !Number.isInteger(s.active_ms) || s.active_ms < 0 || s.active_ms > end - start
      || (s.active_ms === 0 && s.event === null)) return null;
    if (s.active_ms > 0 && kstDay(start) !== kstDay(end - 1)) return null;
    samples.push({ id: s.id, session_id: s.session_id, started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString(),
      active_ms: s.active_ms, feature: s.feature as UsageFeature, event: s.event as UsageEvent | null });
  }
  if (new Set(samples.map(s => s.id)).size !== samples.length) return null;
  return { visitorId: b.visitorId, samples };
}

/** A delayed/background timer never fills the suspended interval with activity. */
export function activeElapsed(previous: number, now: number, lastInteraction: number, foreground: boolean): number {
  if (!foreground || now < previous || now - previous > 10000) return 0;
  return Math.max(0, Math.min(now, lastInteraction + 60000) - previous);
}

export function aggregateUsage(rows: UsageRow[], today: string, days: number) {
  const since = shiftDay(today, 1 - days);
  const periods = (length: number, guest: boolean) => new Set(rows.filter(r => r.active_ms > 0 && kstDay(r.started_at) >= shiftDay(today, 1 - length)
    && kstDay(r.started_at) <= today && (guest ? !r.user_id : !!r.user_id)).map(r => guest ? r.visitor_id : r.user_id)).size;
  const selected = rows.filter(r => kstDay(r.started_at) >= since && kstDay(r.started_at) <= today);
  const sessions = new Map<string, { ms: number; user: string; guest: boolean; dates: Set<string>; viewed: boolean; related: boolean; continued: boolean }>();
  const feature = new Map<UsageFeature, { ms: number; users: Set<string>; sessions: Set<string> }>();
  const daily = new Map<string, { ms: number; members: Set<string>; guests: Set<string>; sessions: Set<string> }>();
  for (let i = days - 1; i >= 0; i--) daily.set(shiftDay(today, -i), { ms: 0, members: new Set(), guests: new Set(), sessions: new Set() });
  for (const r of selected.sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id.localeCompare(b.id))) {
    const user = r.user_id ? `u:${r.user_id}` : `g:${r.visitor_id}`;
    const key = `${user}:${r.session_id}`;
    const s = sessions.get(key) ?? { ms: 0, user, guest: !r.user_id, dates: new Set<string>(), viewed: false, related: false, continued: false };
    if (s.related && r.event === 'explore_step') s.continued = true;
    if (r.feature === 'company') s.viewed = true;
    if (s.viewed && r.event === 'related_company') s.related = true;
    s.ms += r.active_ms;
    if (r.active_ms > 0) s.dates.add(kstDay(r.started_at));
    sessions.set(key, s);
    if (!r.active_ms) continue;
    const f = feature.get(r.feature) ?? { ms: 0, users: new Set<string>(), sessions: new Set<string>() };
    f.ms += r.active_ms; f.users.add(user); f.sessions.add(key); feature.set(r.feature, f);
    const d = daily.get(kstDay(r.started_at))!;
    d.ms += r.active_ms; (s.guest ? d.guests : d.members).add(user); d.sessions.add(key);
  }
  const durations = [...sessions.values()].filter(s => s.ms > 0).map(s => s.ms).sort((a,b) => a-b);
  const totalMs = durations.reduce((a,b) => a+b, 0);
  const mid = Math.floor(durations.length / 2);
  const visitorDays = new Map<string, Set<string>>();
  for (const s of sessions.values()) if (s.ms) { const set = visitorDays.get(s.user) ?? new Set<string>(); s.dates.forEach(d => set.add(d)); visitorDays.set(s.user, set); }
  const viewed = [...sessions.values()].filter(s => s.viewed).length;
  const related = [...sessions.values()].filter(s => s.related).length;
  const continued = [...sessions.values()].filter(s => s.continued).length;
  return {
    members: { dau: periods(1, false), wau: periods(7, false), mau: periods(30, false) },
    guests: { dau: periods(1, true), wau: periods(7, true), mau: periods(30, true) },
    sessions: durations.length, totalMs, averageMs: durations.length ? Math.round(totalMs / durations.length) : null,
    medianMs: durations.length ? (durations.length % 2 ? durations[mid] : (durations[mid-1]+durations[mid])/2) : null,
    visitsPerVisitor: visitorDays.size ? durations.length / visitorDays.size : null,
    daysPerVisitor: visitorDays.size ? [...visitorDays.values()].reduce((n,s) => n+s.size,0) / visitorDays.size : null,
    features: [...feature].map(([id,f]) => ({ id, activeMs: f.ms, visitors: f.users.size, sessions: f.sessions.size })).sort((a,b) => b.activeMs-a.activeMs),
    daily: [...daily].map(([date,d]) => ({ date, activeMs: d.ms, members: d.members.size, guests: d.guests.size, sessions: d.sessions.size })),
    exploration: { viewed, related, continued, rate: viewed ? Math.round(continued / viewed * 100) : null },
  };
}
export type UsageSummary = ReturnType<typeof aggregateUsage>;
