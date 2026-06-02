import type { NextRequest } from 'next/server';
import { runDigest } from '../morning-brief/route';

/**
 * 국장 마감 digest 슬롯 (KST 16:00 = UTC 07:00). vercel.json "0 7 * * *".
 *
 * 슬롯 판정을 wall-clock이 아닌 '경로'로 결정론화하기 위한 얇은 래퍼 — morning-brief route의
 * runDigest()를 'close' 슬롯으로 고정 호출한다(적대 리뷰 must-fix: 재시도 시 슬롯 뒤집힘 방지).
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return runDigest(req, 'close');
}
