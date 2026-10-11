import { describe, it, expect } from 'vitest';
import snapshot from '@/data/industry-catalog.json';
import { classifiedSectors, SECTORS, sectorsForCompany, sectorCompany } from '@/lib/sectorExploration';
import { getStoredIndustry } from '@/lib/storedIndustry';
import { ADDITIONAL_COMPANY_EVIDENCE, ADDITIONAL_SECTORS } from '@/lib/businessSubsectors';
import { newsExploration, explorationCompany } from '@/lib/contextExploration';

describe('business classifications are distinct from provider labels', () => {
  it.each([
    ['IONQ', 'quantum'], ['QUBT', 'quantum'], ['ARQQ', 'post-quantum-security'], ['LAES', 'post-quantum-security'], ['RGTI', 'quantum'], ['QBTS', 'quantum'],
    ['DELL', 'servers'], ['SMCI', 'servers'], ['HPE', 'servers'],
    ['SNDK', 'nand-storage'], ['WDC', 'hdd-storage'], ['STX', 'hdd-storage'],
    ['ANET', 'networking'], ['VRT', 'data-center-power'], ['ETN', 'data-center-power'],
    ['CRWD', 'cybersecurity'], ['PANW', 'cybersecurity'], ['SNOW', 'cloud-data'],
    ['RKLB', 'space-launch'], ['ASTS', 'satellite-communications'],
    ['SMR', 'advanced-nuclear'], ['OKLO', 'advanced-nuclear'], ['CCJ', 'nuclear-fuel'], ['CEG', 'nuclear-generation'],
    ['ISRG', 'surgical-robotics'], ['207940', 'biomanufacturing'],
    ['V', 'payments'], ['HOOD', 'brokerage'], ['SCHW', 'brokerage'], ['COIN', 'digital-assets'], ['FSLR', 'solar-equipment'],
    ['LIN', 'industrial-gases'], ['TSLA', 'automotive'],
  ])('%s is shown in its reviewed business area %s', (symbol, area) => {
    const classification = getStoredIndustry(symbol);
    expect(classifiedSectors(symbol, {classification}).sectors[0].id).toBe(area);
    expect(explorationCompany(symbol)?.business).toBeTruthy();
  });
  it('preserves provider evidence while separating fundamentally different peers', () => {
    expect(getStoredIndustry('IONQ').industryId).toBe(getStoredIndustry('DELL').industryId);
    expect(getStoredIndustry('IONQ').industryId).toBe(getStoredIndustry('SNDK').industryId);
    expect(new Set(['IONQ','DELL','SNDK'].map(s=>classifiedSectors(s).sectors[0].id)).size).toBe(3);
    expect(sectorsForCompany('ARQQ').map(s=>s.id)).not.toContain('quantum');
    expect(sectorsForCompany('LAES').map(s=>s.id)).not.toContain('quantum');
    expect(sectorsForCompany('NVDA').map(s=>s.id)).not.toContain('quantum');
    expect(sectorsForCompany('SNDK').map(s=>s.id)).not.toContain('hdd-storage');
    expect(sectorsForCompany('CCJ').map(s=>s.id)).not.toContain('nuclear-generation');
    expect(sectorsForCompany('BE').map(s=>s.id)).not.toContain('batteries');
    expect(sectorsForCompany('HOOD').map(s=>s.id)).toContain('digital-assets');
    expect(classifiedSectors('UNKNOWN-FIXTURE',{industry:'Computer Hardware'}).basis).toBe('provider');
    expect(sectorsForCompany('UNKNOWN-FIXTURE')).toEqual([]);
  });
  it('requires a real catalog symbol and dated company source for every added assignment', () => {
    for(const item of ADDITIONAL_COMPANY_EVIDENCE){
      expect(item.symbol in snapshot.records).toBe(true);
      expect(new URL(item.source.url).protocol).toBe('https:');
      expect(item.source.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ADDITIONAL_SECTORS.some(s=>s.companies.includes(item.symbol))).toBe(true);
    }
    for(const area of ADDITIONAL_SECTORS){
      expect(SECTORS.find(s=>s.id===area.parent)?.parent).toBeNull();
      for(const symbol of area.companies)expect(explorationCompany(symbol)?.source.url).toBeTruthy();
      expect(sectorCompany(area.anchor)?.business).toBeTruthy();
    }
  });
  it('finds quantum and nuclear fuel as distinct background explanations',()=>{
    expect(newsExploration('아이온큐 양자컴퓨터 기술')).toContain('sector:quantum');
    expect(newsExploration('우라늄 핵연료 공급')).toContain('sector:nuclear-fuel');
    expect(newsExploration('소형모듈원전 인허가')).toContain('sector:advanced-nuclear');
  });
});
