/** Headline routing only. A keyword match is never verification of an event. */
export function contractContext(text: string) {
  const hasContract = /계약|협약|수주|agreement|contract|backlog/i.test(text);
  const terminated = /종료|해지|해제|취소|철회|terminat|cancel|withdraw/i.test(text);
  const proposed = /추진|예정|검토|협의|협상|계획|plan(?:s|ned)?|propos|negotiat/i.test(text);
  const securities = /주식.{0,12}(?:매입|매수|매각|매매|인수|발행)|(?:신주|증자|지분|자사주)|stock.{0,16}(?:purchase|sale)|equity|securities/i.test(text);
  const other = /대출|차입|합병|고용|근로|임대차|라이선스|loan|merger|employment|lease|licen[cs]/i.test(text);
  const sales = /수주|납품|공급.{0,8}계약|판매.{0,8}계약|backlog|supply.{0,12}(?:agreement|contract)|sales.{0,12}contract/i.test(text);
  return { kind: !hasContract ? 'none' : securities ? 'securities' : other ? 'other' : sales ? 'sales' : 'unknown',
    phase: terminated ? 'terminated' : proposed ? 'proposed' : /체결|수주|signed|enters?|entered|awarded/i.test(text) ? 'signed' : 'unknown' } as const;
}

export function hasSalesBacklogContext(text: string): boolean {
  const context = contractContext(text);
  return context.kind === 'sales' && !['terminated', 'proposed'].includes(context.phase);
}
