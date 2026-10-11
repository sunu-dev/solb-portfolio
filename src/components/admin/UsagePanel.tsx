'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { kstDay, USAGE_LABELS, type UsageSummary } from '@/lib/usageMetrics';
import styles from './UsagePanel.module.css';

type UsageData = UsageSummary & { firstSampleAt: string | null; measuredAt: string; days: number };
const duration = (ms: number | null) => {
  if (ms === null) return '—';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
};

export default function UsagePanel() {
  const [days, setDays] = useState(14);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<{ data: UsageData | null; error: string; loading: boolean }>({ data: null, error: '', loading: true });
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState({ data: null, error: '', loading: true });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/admin/usage?days=${days}`, { signal: controller.signal, headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
        const data = await res.json();
        if (!res.ok || !data.available) throw new Error(data.error || '이용 현황을 불러오지 못했어요.');
        if (!controller.signal.aborted) setState({ data, error: '', loading: false });
      } catch (error) {
        if (!controller.signal.aborted) setState({ data: null, error: error instanceof Error ? error.message : '불러오지 못했어요.', loading: false });
      }
    };
    void load(); return () => controller.abort();
  }, [days, refresh]);
  const { data, error, loading } = state;
  return <section className={styles.panel} aria-label="서비스 이용 현황">
    <div className={styles.toolbar}><div><h2>얼마나 자주, 얼마나 오래 사용하나요?</h2><p>가입자 수와 구분해 실제 이용을 확인합니다.</p></div>
      <div className={styles.controls}>{[7,14,30].map(d => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>{d}일</button>)}<button type="button" onClick={() => setRefresh(n => n+1)}>새로고침</button></div>
    </div>
    {loading && <p role="status">이용 현황을 불러오고 있어요…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {data && <>
      <p className={styles.note}>{data.firstSampleAt ? `보관 중인 첫 측정: ${new Date(data.firstSampleAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : '아직 이용시간 기록이 없어요. 측정 이후부터 데이터가 쌓입니다.'} · 한국 시간 기준 · 최근 30일 보관</p>
      <div className={styles.cards}>{[
        ['오늘 활성 회원', `${data.members.dau}명`], ['최근 7일 활성 회원', `${data.members.wau}명`], ['최근 30일 활성 회원', `${data.members.mau}명`],
        ['방문당 평균 사용시간', duration(data.averageMs)], ['방문당 중앙값', duration(data.medianMs)], ['측정된 방문', `${data.sessions}회`],
        ['방문자당 방문 횟수', data.visitsPerVisitor === null ? '—' : `${data.visitsPerVisitor.toFixed(1)}회`],
        ['방문자당 이용한 날짜', data.daysPerVisitor === null ? '—' : `${data.daysPerVisitor.toFixed(1)}일`],
      ].map(([label,value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <p className={styles.note}>비로그인 활성 브라우저: 오늘 {data.guests.dau}개 · 7일 {data.guests.wau}개 · 30일 {data.guests.mau}개. 기기·브라우저 변경이나 로그인 전후에는 별도로 집계될 수 있어요.</p>
      <div className={styles.block}><h3>어디에 시간을 쓰나요?</h3>{data.features.length ? <div className={styles.features}>{data.features.map(f => <div key={f.id}>
        <div><strong>{USAGE_LABELS[f.id]}</strong><span>{duration(f.activeMs)} · 방문자 {f.visitors} · 방문 {f.sessions}</span></div>
        <div className={styles.track}><div style={{ width: `${data.totalMs ? f.activeMs / data.totalMs * 100 : 0}%` }} /></div>
      </div>)}</div> : <p>기능별 이용시간이 아직 없어요.</p>}</div>
      <div className={styles.block}><h3>설명을 읽고 더 탐색하나요?</h3><div className={styles.funnel}>
        <span>기업·산업 설명 <strong>{data.exploration.viewed}방문</strong></span><span>관련 기업 이동 <strong>{data.exploration.related}방문</strong></span><span>이어서 질문 탐색 <strong>{data.exploration.continued}방문</strong></span>
      </div><p>설명 방문 중 이어서 탐색한 비율: <strong>{data.exploration.rate === null ? '—' : `${data.exploration.rate}%`}</strong>. 같은 방문 안에서 순서대로 발생한 기록을 셉니다.</p></div>
      <div className={styles.block}><h3>날짜별 이용</h3><div className={styles.tableWrap}><table><thead><tr><th>날짜</th><th>활성 회원</th><th>비로그인 브라우저</th><th>방문</th><th>사용시간 합계</th></tr></thead><tbody>{data.daily.map(d => <tr key={d.date}><th scope="row">{d.date}</th>{data.firstSampleAt && d.date >= kstDay(data.firstSampleAt) ? <><td>{d.members}</td><td>{d.guests}</td><td>{d.sessions}</td><td>{duration(d.activeMs)}</td></> : <td colSpan={4}>미수집</td>}</tr>)}</tbody></table></div></div>
      <details className={styles.block}><summary>측정 기준과 한계</summary><p>활성 회원은 측정된 사용시간이 있는 계정입니다. 숨겨진 탭·포커스가 없는 창·마지막 조작 이후 1분을 넘긴 시간은 제외합니다. 페이지를 새로 열거나 새로고침하면 새 방문으로 셉니다. 같은 페이지에서도 30분간 조작이 없으면 다음 조작부터 새 방문으로 셉니다. 여러 탭은 별도 방문이며 로그인 전후 방문도 분리합니다. 평균·중앙값·기능·탐색은 선택한 기간, 7일·30일 활성 수는 오늘까지 고정 기간입니다.</p><p>관리자 계정과 자동화 브라우저는 수집에서 제외합니다. 네트워크 차단·종료 시 전송 실패·브라우저 저장소 삭제로 일부 이용이 빠질 수 있어요. 측정 전 사용시간은 복원하지 않습니다. 읽는 중 조작이 없다면 1분 이후의 독서는 포함되지 않습니다. 보유종목·메모·검색어·URL은 이 기록에 넣지 않습니다.</p></details>
    </>}
  </section>;
}
