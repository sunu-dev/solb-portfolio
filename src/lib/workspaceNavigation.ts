import type { MainSection } from '@/store/portfolioStore';

export function workspaceSection(params: URLSearchParams): MainSection {
  const value = params.get('view') || params.get('section');
  if (params.has('guide')) return 'insights';
  if (value === 'analysis') return 'events';
  return value === 'insights' || value === 'events' || value === 'news' ? value : 'portfolio';
}

export function workspaceUrl(current: string, section: MainSection, symbol: string | null): string {
  const url = new URL(current);
  url.searchParams.delete('section');
  if (section === 'portfolio') url.searchParams.delete('view');
  else url.searchParams.set('view', section);
  if (section !== 'insights') url.searchParams.delete('guide');
  if (section !== 'events') {
    url.searchParams.delete('tool');
    url.searchParams.delete('group');
  }
  if (symbol) url.searchParams.set('stock', symbol);
  else url.searchParams.delete('stock');
  return `${url.pathname}${url.search}${url.hash}`;
}
