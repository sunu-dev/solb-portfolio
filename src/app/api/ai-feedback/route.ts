import { NextRequest, NextResponse } from 'next/server';
import { requireServiceClient } from '@/lib/supabaseServer';

/**
 * AI 추천 품질 1탭 피드백 (👍/👎)
 *
 * POST /api/ai-feedback
 * body: { source, symbol?, rating: 1 | -1, context?, comment? }
 * auth: Bearer (로그인 사용자만)
 *
 * 용도: priorityScore 가중치 검증, 멘토 효과 측정 (ALGORITHM_REVIEW.md §5)
 */

export const runtime = 'nodejs';

// 모듈 스코프에서 클라이언트를 만들면 키가 없을 때 **빌드 전체가 실패**한다
// (Next가 page data 수집 중 이 모듈을 import한다). 요청 시점 지연 생성으로 국소화.
const supabaseAdmin = () => requireServiceClient();

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: { user } } = await supabaseAdmin().auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json() as {
    source?: string;
    symbol?: string;
    rating?: number;
    context?: Record<string, unknown>;
    comment?: string;
  };

  if (!body.source || (body.rating !== 1 && body.rating !== -1)) {
    return NextResponse.json({ error: 'source and rating(1|-1) required' }, { status: 400 });
  }

  // source 화이트리스트 (자유 텍스트 폭주 방지)
  const validPrefix = ['ai-chok', 'ai-analysis', 'mentor:'];
  if (!validPrefix.some(p => body.source!.startsWith(p))) {
    return NextResponse.json({ error: 'invalid source' }, { status: 400 });
  }

  const comment = (body.comment || '').slice(0, 200);

  const { error } = await supabaseAdmin()
    .from('ai_feedback')
    .insert({
      user_id: user.id,
      source: body.source,
      symbol: body.symbol || null,
      rating: body.rating,
      context: body.context || null,
      comment: comment || null,
    });

  if (error) {
    console.error('[ai-feedback] db error:', error);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
