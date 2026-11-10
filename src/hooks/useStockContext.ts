import { useEffect, useState } from 'react';
import { isStockContextPacket, type StockContextPacket } from '@/lib/stockContextPacket';

export function useStockContext(symbol: string): StockContextPacket[] {
  const [result,setResult]=useState<{symbol:string;packets:StockContextPacket[]} | null>(null);
  useEffect(()=>{
    // The pilot cannot call a candidate endpoint in the public production UI.
    if(process.env.NODE_ENV!=='development'||!symbol)return;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),4000);
    fetch(`/api/stock-context?symbol=${encodeURIComponent(symbol)}`,{signal:controller.signal})
      .then(r=>r.ok?r.json():null).then(value=>{
        if(!controller.signal.aborted)setResult({symbol,packets:Array.isArray(value?.packets)?value.packets.filter(isStockContextPacket):[]});
      }).catch(()=>{}).finally(()=>clearTimeout(timeout));
    return()=>{controller.abort();clearTimeout(timeout);};
  },[symbol]);
  return result?.symbol===symbol?result.packets:[];
}
