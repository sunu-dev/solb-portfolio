import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createBusinessModel } from '@/lib/companyBusiness/model';
import type { BusinessEvidence } from '@/lib/companyBusiness/types';
const sdk=vi.hoisted(()=>({countTokens:vi.fn(),generateContent:vi.fn()}));
vi.mock('@google/genai',()=>({GoogleGenAI:class{models=sdk;}}));
const evidence:BusinessEvidence={identity:{symbol:'TEST',issuerId:'0000000123',name:'Test',market:'US',provider:'sec',identityUrl:'https://data.sec.gov/submissions/CIK0000000123.json',verifiedAt:'2026-11-01'},documentId:'0000000123-26-000001',url:'https://www.sec.gov/Archives/edgar/data/123/000000012326000001/report.htm',title:'Report',publishedAt:'2026-02-01',retrievedAt:'2026-11-01',bodyHash:'a'.repeat(64),passages:[]};
beforeEach(()=>{vi.resetAllMocks();sdk.countTokens.mockResolvedValue({totalTokens:500});});
describe('business model cost and failure handling',()=>{
 it('does not call generation or a fallback after the shared budget refuses it',async()=>{
  const reserve=vi.fn(async()=>({status:'limit_reached' as const})),settle=vi.fn();
  await expect(createBusinessModel('test-key',{reserve,settle}).draft('business:TEST:1:draft',evidence)).rejects.toThrow('business_model_blocked_limit_reached');
  expect(sdk.generateContent).not.toHaveBeenCalled();expect(settle).not.toHaveBeenCalled();
 });
 it('classifies a provider outage without leaking its message or releasing an uncertain reservation',async()=>{
  sdk.generateContent.mockRejectedValue({status:503,message:'https://example.invalid?key=do-not-log'});
  const reserve=vi.fn(async()=>({status:'reserved' as const,token:randomUUID()})),settle=vi.fn();
  await expect(createBusinessModel('test-key',{reserve,settle}).draft('business:TEST:2:draft',evidence)).rejects.toThrow(/^business_model_unsettled_call_uncertain_provider_unavailable$/);
  expect(sdk.generateContent).toHaveBeenCalledOnce();expect(settle).not.toHaveBeenCalled();
 });
});
