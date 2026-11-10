'use client';
import { useRef, useState, useSyncExternalStore } from 'react';
import appUI from '@/components/ui/AppUI.module.css';
import { ARRIVAL_CITIES } from '@/config/arrivalCities';
import { refreshArrivalWeather } from '@/hooks/useArrivalMessage';

const subscribe=(listener:()=>void)=>{window.addEventListener('arrival-city',listener);return()=>window.removeEventListener('arrival-city',listener);};
const getCity=()=>{try{return localStorage.getItem('joobi-arrival-city-v1')??'';}catch{return '';}};
export default function ArrivalPreferences() {
  const city=useSyncExternalStore(subscribe,getCity,()=> '');
  const request=useRef(0);
  const [status,setStatus]=useState('');
  async function change(value:string) {
    const id=++request.current;
    try {localStorage.setItem('joobi-arrival-city-v1',value);localStorage.removeItem('joobi-arrival-weather-v1');} catch {}
    window.dispatchEvent(new Event('arrival-city'));
    setStatus(value?'선택한 지역의 예보를 확인하고 있어요.':'계절과 시간에 맞는 인사를 전할게요.');
    const ok=await refreshArrivalWeather(value);
    if(value && id===request.current) setStatus(ok?'다음 접속부터 이 지역의 예보도 인사에 반영해요.':'지금은 예보를 확인하지 못했어요. 계절과 시간에 맞춰 인사할게요.');
  }
  return <section aria-labelledby="weather-region-title" style={{marginBottom:28,paddingBottom:28,borderBottom:'1px solid var(--border-light)',color:'var(--text-secondary)'}}>
    <h3 id="weather-region-title" style={{fontSize:'var(--type-group-size)',fontWeight:650,color:'var(--text-primary)',margin:'0 0 8px'}}>날씨 지역</h3>
    <p id="weather-region-help" style={{fontSize:12,lineHeight:1.6,margin:'0 0 12px'}}>지역을 선택하면 첫 화면에서 날씨에 맞는 한마디도 전해드려요.</p>
    <label htmlFor="weather-region" style={{fontSize:12}}>지역 선택</label>
    <select id="weather-region" aria-describedby="weather-region-help" className={appUI.field} value={city} onChange={event=>void change(event.target.value)} style={{display:'block',width:'100%',minHeight:44,marginTop:8}}>
      <option value="">사용 안 함</option>{ARRIVAL_CITIES.map(item=><option key={item.id} value={item.id}>{item.area}</option>)}
    </select>
    <p style={{fontSize:12,lineHeight:1.6,margin:'10px 0'}}>현재 위치는 수집하지 않으며, 선택한 지역은 이 브라우저에만 저장돼요.</p>
    <p role="status" style={{fontSize:12,lineHeight:1.6,margin:status?'8px 0':0}}>{status}</p>
    <a href="https://www.weather.go.kr/plus/rss.jsp" target="_blank" rel="noreferrer" style={{fontSize:11}}>기상청 단기예보 기준</a>
  </section>;
}
