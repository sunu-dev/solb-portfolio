import { describe, it, expect } from 'vitest';
import { auditBusinessMapping } from '@/lib/companyBusiness/coverage';
import { businessReviewPacket } from '@/lib/companyBusiness/reviewPacket';

describe('business operations readiness', () => {
  it('preserves the whole denominator and does not count a directory match as an explanation', () => {
    const audit = auditBusinessMapping({ checkedAt:'2026-11-01', inventory:[
      {symbol:'AAPL',priority:0},{symbol:'0001A0.KQ',priority:0},{symbol:'UNKNOWN',priority:1},{symbol:'CONFLICT',priority:1,conflict:true},
    ], sec:[{symbol:'AAPL',name:'Apple',issuerId:'0000320193'}] });
    expect(audit.total).toBe(4); expect(audit.explanationReady).toBe(false);
    expect(audit.markets).toEqual({KR:1,US:3});
    expect(audit.counts).toEqual({directory_match:1,identity_conflict:1,not_in_directory:1,domestic_not_configured:1});
  });
  it('requires an unambiguous domestic mapping even when the key and directory are available', () => {
    const row={symbol:'0001A0',name:'회사',issuerId:'00123456'};
    const audit=auditBusinessMapping({checkedAt:'2026-11-01',inventory:[{symbol:'0001A0.KQ',priority:0}],sec:[],dart:[row,{...row,issuerId:'00123457'}]});
    expect(audit.rows[0].state).toBe('identity_conflict');expect(audit.rows[0]).not.toHaveProperty('issuerId');
  });
  it('never turns an absent draft into an approval or executable source content', () => {
    const html=businessReviewPacket('<script>alert(1)</script>',{evidence:null,draft:null,review:null},'<img src=x onerror=alert(1)>','2026-11-01');
    expect(html).toContain('설명 초안은 아직 없어요');expect(html).toContain("default-src 'none'");
    expect(html).not.toContain('<script>');expect(html).not.toContain('<img');expect(html).not.toContain('<form');expect(html).not.toContain('<button');
    expect(html).toContain('&lt;script&gt;');expect(html).toContain('이 파일을 열었다는 사실은 승인이 아니에요');
  });
});
