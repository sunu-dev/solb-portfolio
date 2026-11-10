import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import preview from '@/data/stock-context-preview.json';
import { isStockContextPacket } from '@/lib/stockContextPacket';

/** Preview bridge only. Does not grant editorial approval or publish model output. */
export function GET(request: NextRequest) {
  const symbol=request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();
  if(!symbol||!/^[A-Z0-9.^-]{1,20}$/.test(symbol))return NextResponse.json({error:'invalid_symbol'},{status:400});
  if(process.env.NODE_ENV!=='development'||process.env.JOOBI_CONTEXT_PREVIEW!=='true') {
    return NextResponse.json({status:'none',packets:[]},{headers:{'Cache-Control':'public, s-maxage=60'}});
  }
  const packets=(preview.packets as unknown[]).filter(isStockContextPacket).filter(p=>{
    const {version,...body}=p;
    return p.symbol===symbol&&Date.parse(p.validUntil)>Date.now()
      &&createHash('sha256').update(JSON.stringify(body)).digest('hex')===version;
  });
  return NextResponse.json({status:packets.length?'preview':'none',packets},{headers:{'Cache-Control':'no-store'}});
}
