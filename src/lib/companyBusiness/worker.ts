import { randomUUID } from 'node:crypto';
import { runBusinessCycle } from './cycle';
import { createBusinessPort } from './store';
import { createConfiguredBusinessModel } from './provider';
import { createMarketCauseBudgetPort } from '../marketCause/supabaseBudgetPort';
import { getStoredIndustry } from '../storedIndustry';
import { collectDartBusiness, collectSecBusiness, dartDirectory, secDirectory } from './sources';
import { businessMarket } from './market';
/** Queue claims and the existing shared model budget both constrain work. No portfolio/user records are read. */
export async function runBusinessWorker(symbol?: string) {
  const dartKey = process.env.DART_API_KEY || process.env.OPENDART_API_KEY || '';
  return runBusinessCycle({ owner: randomUUID(), port: createBusinessPort(dartKey ? 'all' : 'US', symbol), now: () => new Date().toISOString(),
    model: () => createConfiguredBusinessModel({ provider: process.env.COMPANY_BUSINESS_PROVIDER,
      anthropicKey: process.env.ANTHROPIC_API_KEY, geminiKey: process.env.GEMINI_API_KEY }, createMarketCauseBudgetPort()),
    collect: async candidate => {
      const profile = getStoredIndustry(candidate);
      if (['etp', 'shell', 'instrument', 'conflict'].includes(profile.status)) throw new Error('issuer_ambiguous');
      return businessMarket(candidate) === 'KR'
        ? collectDartBusiness(candidate, await dartDirectory(dartKey), dartKey)
        : collectSecBusiness(candidate, await secDirectory());
    },
  });
}
