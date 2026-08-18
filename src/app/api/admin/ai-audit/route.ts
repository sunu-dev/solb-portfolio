import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { buildAiAuditCoverage } from '@/lib/aiAuditCoverage';
import { redactAiAuditExport } from '@/lib/aiAuditExport';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

/** 관리자 판정은 `@/lib/adminAuth` 한 곳이 SSOT. 이 파일에는 목록을 두지 않는다. */
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  return (await requireAdmin(req)).ok;
}

export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  if (req.nextUrl.searchParams.get('export') === '1') {
    const { data, error } = await supabaseAdmin
      .from('ai_output_audits')
      .select('id, created_at, feature, symbol, output, source_snapshot, flags, severity, reviewed_at, review_note')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: 'export failed' }, { status: 500 });

    const generatedAt = new Date().toISOString();
    const payload = redactAiAuditExport({
      manifest: {
        generatedAt,
        purpose: '주비 AI 출력 법률·컴플라이언스 검토',
        privacy: '사용자 식별자, 프롬프트, 평단, 보유수량, 목표수익률, 손절값, 사용자 메모를 제외했어요.',
        rowCount: data?.length || 0,
      },
      rows: data || [],
    });
    const date = generatedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="joobi-ai-audit-${date}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const severity = req.nextUrl.searchParams.get('severity') || 'all';
  let query = supabaseAdmin
    .from('ai_output_audits')
    .select('id, created_at, feature, symbol, output, source_snapshot, flags, severity, reviewed_at, review_note')
    .order('created_at', { ascending: false })
    .limit(100);
  if (severity !== 'all') query = query.eq('severity', severity);

  const [listResult, summaryResult] = await Promise.all([
    query,
    supabaseAdmin
      .from('ai_output_audits')
      .select('feature, severity, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(5000),
  ]);
  const { data, error } = listResult;
  if (error) {
    const missing = error.code === '42P01';
    return NextResponse.json({
      available: false,
      message: missing
        ? 'ai_output_audits 마이그레이션을 적용하면 감사 표본이 표시돼요.'
        : '감사 데이터를 불러오지 못했어요.',
      rows: [],
    });
  }

  if (summaryResult.error) {
    return NextResponse.json({ available: false, message: '감사 표본 집계를 불러오지 못했어요.', rows: [] });
  }

  const rows = data || [];
  const allRows = summaryResult.data || [];
  const targetPerFeature = Number(process.env.AI_AUDIT_TARGET_PER_FEATURE || '100');
  return NextResponse.json({
    available: true,
    sampleRate: Number(process.env.AI_AUDIT_SAMPLE_RATE || '0'),
    rows,
    summary: {
      total: allRows.length,
      high: allRows.filter(row => row.severity === 'high').length,
      review: allRows.filter(row => row.severity === 'review').length,
      unreviewed: allRows.filter(row => !row.reviewed_at).length,
    },
    coverage: buildAiAuditCoverage(allRows, targetPerFeature),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json() as { id?: number; reviewNote?: string };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('ai_output_audits')
    .update({ reviewed_at: new Date().toISOString(), review_note: body.reviewNote?.slice(0, 1000) || null })
    .eq('id', body.id);
  if (error) return NextResponse.json({ error: 'update failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
