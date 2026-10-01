import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

interface InsertedCode {
  code: string;
  type: string;
  max_uses: number;
  description: string;
  metadata: {
    batch_id?: string;
    batch_index?: number;
    batch_total?: number;
    batch_size?: number;
  };
}

const mock = vi.hoisted(() => ({
  inserted: [] as InsertedCode[],
  getUser: vi.fn(),
}));

vi.mock('@/lib/adminAuth', () => ({ isAdminIdentity: () => true }));
vi.mock('@/lib/supabaseServer', () => ({
  requireServiceClient: () => ({
    auth: { getUser: mock.getUser },
    from: () => ({
      select: () => ({
        in: async () => ({ data: [], error: null }),
      }),
      insert: (rows: InsertedCode[]) => ({
        select: async () => {
          mock.inserted = rows;
          return {
            data: rows.map(row => ({ ...row, created_at: '2026-09-18T00:00:00.000Z' })),
            error: null,
          };
        },
      }),
    }),
  }),
}));

import { POST } from '@/app/api/codes/generate/route';

const request = (body: unknown) => new NextRequest('https://example.test/api/codes/generate', {
  method: 'POST',
  headers: { authorization: 'Bearer admin-token' },
  body: JSON.stringify(body),
});

describe('관리자 초대코드 묶음 생성', () => {
  beforeEach(() => {
    mock.inserted = [];
    mock.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null });
  });

  it('JOOBI 코드 100개를 10개씩 10묶음으로 원자 삽입한다', async () => {
    const response = await POST(request({
      type: 'invite',
      count: 100,
      batch_size: 10,
      max_uses: 1,
      description: '관리자 대량 초대',
    }));

    expect(response.status).toBe(200);
    expect(mock.inserted).toHaveLength(100);
    expect(new Set(mock.inserted.map(row => row.code)).size).toBe(100);
    expect(mock.inserted.every(row => /^JOOBI-[A-HJ-NP-Z2-9]{8}$/.test(row.code))).toBe(true);
    expect(new Set(mock.inserted.map(row => row.metadata.batch_id)).size).toBe(1);

    for (let index = 0; index < 10; index++) {
      const batch = mock.inserted.slice(index * 10, index * 10 + 10);
      expect(batch).toHaveLength(10);
      expect(batch.every(row => row.metadata.batch_index === index + 1)).toBe(true);
      expect(batch.every(row => row.metadata.batch_total === 10 && row.metadata.batch_size === 10)).toBe(true);
      expect(batch.every(row => row.description.endsWith(`묶음 ${String(index + 1).padStart(2, '0')}/10`))).toBe(true);
    }
  });

  it('지원하지 않는 코드 유형은 삽입 전에 거절한다', async () => {
    const response = await POST(request({ type: 'unknown', count: 10 }));
    expect(response.status).toBe(400);
    expect(mock.inserted).toHaveLength(0);
  });
});
