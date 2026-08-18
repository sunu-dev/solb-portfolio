import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/portfolio/ocr/route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('OCR API 최전방 보호 게이트', () => {
  it('유료 처리 환경 확인 전에는 multipart 파싱보다 먼저 503으로 닫힌다', async () => {
    vi.stubEnv('NEXT_PUBLIC_OCR_ENABLED', 'true');
    vi.stubEnv('GEMINI_PAID_SERVICE', 'false');
    const request = new NextRequest('http://localhost/api/portfolio/ocr', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ code: 'disabled' });
  });

  it('처리 환경이 열려도 인증 없는 요청은 파일을 읽기 전에 401로 거절한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_OCR_ENABLED', 'true');
    vi.stubEnv('GEMINI_PAID_SERVICE', 'true');
    const request = new NextRequest('http://localhost/api/portfolio/ocr', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ code: 'unauthorized' });
  });
});
