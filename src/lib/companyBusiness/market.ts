/** KRX stock codes can contain letters. Keep the exchange suffix and never infer a US issuer from that letter. */
export function businessMarket(symbol: string): 'KR' | 'US' {
  return /^(?:[A-Z0-9]{6}\.(?:KS|KQ)|[0-9][A-Z0-9]{5})$/.test(symbol.trim().toUpperCase()) ? 'KR' : 'US';
}
