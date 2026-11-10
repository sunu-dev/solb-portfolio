const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
let state,run,selected,view='cases';
const api=async(url,body)=>{const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json','x-lab-session':state.token},body:JSON.stringify(body)}:{});const x=await r.json();if(!r.ok)throw Error(x.error);return x;};
const fail=e=>{$('#error').textContent=e.message;$('#error').hidden=false;};
const when=date=>new Date(date).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const blocked=row=>row.findings.some(f=>f.severity==='critical')||row.assessment?.trust?.status==='failed';
function explanationStatusHtml(row) {
  const x=row.explanationStatus;
  const labels={'needs-work':'보완 필요','unassessed':'미수집·미확인','review-pending':'원문·문맥 검수 대기','observed':'전달 동작 확인'};
  return `<section class="task" aria-label="내용과 화면의 공동 검수"><h3>내용과 화면을 함께 확인해요</h3><p>${x?.contentKind==='fund'?'상품 내용':'기업 내용'}: ${esc(labels[x?.content]||labels.unassessed)}</p><p>화면 설명·질문·용어: ${esc(labels[x?.screen]||labels.unassessed)}</p><p class="muted">한쪽의 생성·클릭 성공으로 전체 검수를 완료하지 않아요. 사실의 의미와 초보자 이해는 별도로 확인합니다.</p></section>`;
}
const options=()=>state.runs.map(r=>`<option value="${r.id}">${esc(when(r.createdAt))} · ${esc(r.label)} · ${r.assessed}/${r.count} 채점</option>`).join('');
async function load(id){run=await api('/api/run?id='+id);selected=run.cases[0]?.symbol;render();}
function render(){
  if(!run){$('#content').textContent='아직 검사 기록이 없어요. 공개 화면 표본을 가져온 뒤 확인할 수 있어요.';return;}
  const critical=run.cases.filter(blocked),assessed=run.cases.filter(r=>r.assessment).length;
  $('#attention').innerHTML=critical.length?`<p class="attention-title">반영을 막는 문제 ${critical.length}건</p><p>${esc(critical.map(r=>r.name).join(', '))}에서 신뢰 또는 동작 결함을 발견했어요. 다른 항목의 점수로 상쇄하지 않아요.</p>`:`<p class="attention-title">검수 상태 확인이 필요해요</p><p>치명적 패턴이 탐지되지 않아도 정확성이 검증됐다는 뜻은 아니에요.</p>`;
  if(run.annotation?.invalidated)$('#attention').innerHTML=`<p class="attention-title">수집기 오류로 사용을 중단한 기록이에요</p><p>${esc(run.annotation.reason)} 아래 기록은 오류 분석용으로 보존하며 제품 결함이나 개선 점수로 사용하지 않아요.</p>`;
  $('#version').textContent=`엔진 ${run.engineVersion} / ${run.rubric.id} / ${assessed}개 채점`;
  document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===view?'page':'false'));
  if(view==='cases')renderCases();
  if(view==='backlog')renderBacklog();
  if(view==='rubric')renderRubric();
  if(view==='compare')renderCompare();
  if(view==='candidates')renderCandidates().catch(fail);
  if(view==='work')renderWork().catch(fail);
}
async function renderWork(){
  $('#content').textContent='개선 작업을 불러오고 있어요…';
  const {tasks}=await api('/api/improvements');if(view!=='work')return;
  const labels={'queued':'처리 대기','source-queued':'수집 작업에 전달됨','source-unconfigured':'국내 공시 연결 필요','collecting':'출처 수집 중','review_pending':'설명 검수 중','approval_pending':'편집 검수 대기','published-awaiting-capture':'운영 화면 확인 대기','publication-withheld':'공개 보류','verified-delivery':'운영 화면 반영 확인','blocked':'원인 확인·수정 필요','engineering-review':'구현 검토 필요','regression':'재발 확인','not-covered':'발행사 목록 확인 필요'};
  $('#content').innerHTML=`<section class="backlog"><h2>발견한 문제의 처리 과정</h2><p class="muted">같은 문제는 하나의 작업으로 이어갑니다. 생성·검수·공개·화면 확인은 각각 구분합니다. 운영 화면 반영 확인은 전체 내용 검수 완료와 별개입니다.</p>${tasks.map(t=>`<article class="task"><h3>${esc(t.symbol)} · ${esc(labels[t.state]||t.state)}</h3><p>${esc(t.kind==='company-business'?'사업·고객·수익 구조 설명 보완':t.kind==='company-content-review'?'기존 기업 설명의 누락·출처·반복·문장 검토':t.kind==='news-diagnosis'?'기사 조회 경로 확인':t.kind==='explanation-exploration'?'첫 설명·투자 대상·산업 탐색 개선':t.kind==='question-reading-review'?'질문·답변·다음 연결 읽기 검토':'공통 동작·문맥 개선')}</p>${t.progress?`<p>출처 ${t.progress.sourceCollected?'확보':'대기'} · 초안 ${t.progress.drafted?'작성':'대기'} · 모델 검수 ${t.progress.modelReviewed?'통과':'미완료'} · 편집 검수 ${t.progress.editoriallyApproved?'완료':'미완료'}</p>`:''}<p class="muted">${t.observations.length}개 검사 기록 연결 · 최근 ${esc(when(t.observations.at(-1)?.observedAt))}</p>${t.state==='source-unconfigured'?'<p>OpenDART 연결 후 실제 공시에서 확인합니다. 제품명만으로 수익 구조를 만들지 않습니다.</p>':''}${t.progress?.reason?`<details><summary>처리 기록</summary><code>${esc(t.progress.reason)}</code></details>`:''}</article>`).join('')||'<p>등록된 개선 작업이 없습니다.</p>'}</section>`;
}
async function renderCandidates(){
  $('#content').textContent='개선안을 불러오고 있어요…';
  const {candidates}=await api('/api/context-candidates');
  if(view!=='candidates')return;
  $('#content').innerHTML=`<section class="backlog"><h2>원문에서 화면까지</h2><p class="muted">원문 일치 검사를 통과한 초안이에요. 설명의 의미·유용성 검수와 운영 공개는 아직 완료되지 않았어요.</p>${candidates.map(c=>{const p=c.packet;return `<article class="task"><h3>${esc(p.symbol)} · ${esc(p.title)}</h3><p>${esc(p.summary)}</p><p class="muted">검토용 · ${Date.parse(p.validUntil)>Date.now()?'유효 기간 내':'만료됨'} · 편집 검토 대기 · 운영 미공개</p><p><a href="${esc(p.source.url)}" target="_blank" rel="noopener noreferrer">${esc(p.source.label)} 원문 ↗</a> · 사건 ${esc(p.event.effectiveDate)} · 공시 ${esc(p.source.publishedAt.slice(0,10))}</p>${p.questions.map(q=>`<details><summary>${esc(q.title)}</summary><p>${esc(q.answer)}</p><small>연결된 근거: ${esc(q.sourceFacts.join(', '))}</small></details>`).join('')}<p><strong>이어서 확인할 것</strong> ${esc(p.watch)}</p><details><summary>검사 결과와 버전</summary><p>종목·날짜·상대방 일치, 인용문 위치, 묶음 무결성을 검사했어요. 이 검사는 번역과 해석의 정확성을 보증하지 않아요.</p><p class="muted">컴파일러 ${esc(c.compiler)} · 설명 ${esc(p.version.slice(0,16))} · 원문 ${esc(p.source.contentHash.slice(0,16))}</p></details></article>`;}).join('')||'<p>저장된 개선안이 없어요.</p>'}</section>`;
}
function renderCases(){
  const row=run.cases.find(r=>r.symbol===selected)||run.cases[0];
  const evidenceLines = row.sections["거래일 브리핑"].split("\n").filter(t => /주식 매입 계약 종료|큰 계약을 따면|납품 시기/.test(t));
  const lead = blocked(row) && evidenceLines.length ? `<blockquote>${esc(evidenceLines.join("\n"))}</blockquote>` : "";
  $('#content').innerHTML=`<div class="workspace"><aside aria-label="검사 종목"><label class="mobile-case">검사 종목<select id="mobile-case">${run.cases.map(r=>`<option value="${esc(r.symbol)}" ${r.symbol===row.symbol?"selected":""}>${esc(r.name)} · ${r.assessment?.total??"미채점"}</option>`).join("")}</select></label><p class="muted">고정 표본 ${run.cases.length}개 · 실패도 포함</p><ul class="case-list">${run.cases.map(r=>`<li><button class="case-button" data-symbol="${esc(r.symbol)}" aria-pressed="${r.symbol===row.symbol}"><strong>${esc(r.name)}</strong><small>${esc(r.symbol)}</small><span class="score">${r.assessment?r.assessment.total:'—'}<small>${r.assessment?' / 100':' 미채점'}</small></span><span class="status ${blocked(r)?'danger':''}">${blocked(r)?'반영 차단':`${r.findings.length}개 점검 항목`}</span></button></li>`).join('')}</ul></aside><section id="detail"><div class="detail-head"><h2>${esc(row.name)}</h2><a target="_blank" rel="noopener noreferrer" href="https://joobi.kr/?view=news&amp;stock=${encodeURIComponent(row.symbol)}">운영 화면 열기 ↗</a></div><p class="muted">${esc(row.symbol)} · ${esc(when(row.checkedAt))} 수집</p>${lead}${explanationStatusHtml(row)}<ul class="findings">${row.findings.map(f=>`<li class="finding"><strong class="${f.severity==='critical'?'danger':''}">${esc(f.title)}</strong><p>${esc(f.proposal)}</p></li>`).join('')||'<li>알려진 패턴이 탐지되지 않았어요. 내용 검수는 별도예요.</li>'}</ul><details open><summary>채점과 이유</summary><p class="muted">${esc(row.assessment?.note||'자동 탐지만 완료했어요. 논리와 디자인 점수는 근거를 확인한 뒤 기록해요.')}</p>${row.assessment?`<ul class="axes">${run.rubric.axes.map(a=>{const v=row.assessment.axes[a.id];return `<li><div class="axis-title"><span>${esc(a.label)}</span><span>${v.score} / ${a.max}</span></div><p>${esc(v.reason)}</p></li>`;}).join('')}</ul><p class="${blocked(row)?'danger':'muted'}">사실·문맥 검수: ${esc(({unreviewed:'원문 대조 미완료',failed:'신뢰 결함 확인',verified:'기록된 범위 검수'})[row.assessment.trust.status])}. ${esc(row.assessment.trust.reason)}</p>`:''}</details><details open><summary>수집한 화면</summary><div class="screen-grid">${row.screenshots.map((key,i)=>`<a href="/images/${key}" target="_blank" rel="noopener"><img src="/images/${key}" alt="${esc(row.name)} ${['회사 이해','거래일 브리핑','배우기'][i]||'검사'} 화면" loading="lazy">${['회사 이해','거래일 브리핑','배우기'][i]||'검사 화면'}</a>`).join('')}</div></details>${Object.entries(row.sections).map(([title,value])=>`<details><summary>${esc(title)} 실제 문장</summary><pre>${esc(value||'수집하지 못했어요.')}</pre></details>`).join('')}</section></div>`;
  if($('#mobile-case'))$('#mobile-case').onchange=()=>{selected=$('#mobile-case').value;renderCases();};
  document.querySelectorAll('[data-symbol]').forEach(b=>b.onclick=()=>{selected=b.dataset.symbol;renderCases();if(innerWidth<701)$('#detail').scrollIntoView({block:'start'});});
}
function renderBacklog(){
  $('#content').innerHTML=`<section class="backlog"><h2>공통 원인을 먼저 고쳐요</h2><p class="muted">문구 한 곳의 교체가 아니라 같은 결함이 생기는 경로를 개선해요. 아래 과제는 아직 제품 반영 전이에요.</p>${run.backlog.map(b=>`<article class="task"><h3><span class="priority ${b.priority==='P0'?'danger':''}">${b.priority}</span>${esc(b.title)}</h3><p>${esc(b.proposal)}</p><p><strong>검수 조건</strong> ${esc(b.acceptance)}</p><small>발견 ${b.affected.length}개: ${esc(b.affected.join(', '))} · 개선 전</small></article>`).join('')}</section>`;
}
function renderRubric(){
  $('#content').innerHTML=`<section class="rubric"><h2>점수보다 신뢰가 먼저예요</h2><p>회사·기간·사건을 잘못 연결하거나 근거 없는 사실을 제공하면 다른 항목의 점수와 관계없이 반영을 차단해요.</p>${run.rubric.axes.map(a=>`<article><h3>${esc(a.label)} · ${a.max}점</h3><p>${esc(a.anchors.join(' → '))}</p></article>`).join('')}<article><h3>평가 엔진도 검증해요</h3><p>기준 또는 엔진 버전이 달라진 점수는 직접 비교하지 않아요. 사람이 정정한 사례를 회귀 검사에 추가하고, 새로운 종목에서도 다시 확인해야 해요.</p><p>현재는 알려진 패턴의 자동 탐지와 근거가 있는 평가 기록을 지원해요. 의미 판단 모델과 사용자 이해도 실험은 아직 연결하지 않았어요.</p></article></section>`;
}
function renderCompare(){
  $('#content').innerHTML=`<section><h2>동일한 기준으로 전후를 비교해요</h2><p class="muted">표본·평가 기준·탐지 엔진이 같아야 해요. 실시간 뉴스 변화와 코드 수정 효과는 별도로 확인해야 해요.</p><div class="compare-controls"><label>이전 기록<select id="before">${options()}</select></label><label>이후 기록<select id="after">${options()}</select></label><button id="compare">비교하기</button></div><div id="comparison"></div></section>`;
  if(state.runs.length>1)$('#before').value=state.runs[1].id;
  $('#after').value=run.id;
  $('#compare').onclick=async()=>{try{const r=await api(`/api/compare?before=${$('#before').value}&after=${$('#after').value}`);$('#comparison').innerHTML=`<h3>${esc(r.decision)}</h3>${r.reasons.map(x=>`<p>${esc(x)}</p>`).join('')}<p class="muted">${r.sameContent?'수집 문장이 같아요. 제품 내용 개선으로 세지 않아요.':''}</p><table><thead><tr><th>종목</th><th>점수 변화</th><th>축별 하락</th></tr></thead><tbody>${r.deltas.map(x=>`<tr><td>${esc(x.symbol)}</td><td>${x.delta===null?'비교 불가':(x.delta>0?'+':'')+x.delta}</td><td>${x.regression===null?'미평가':x.regression?'있음':'없음'}</td></tr>`).join('')}</tbody></table><p class="muted">${esc(r.note)}</p>`;}catch(e){fail(e);}};
}
async function refresh(){
  state=await api('/api/state');const old=$('#runs').value;
  $('#runs').innerHTML=options();if(state.runs.some(r=>r.id===old))$('#runs').value=old;
  $('#scan').disabled=!state.runs.length||state.job?.status==='running';
  $('#cancel').hidden=state.job?.status!=='running';
  $('#schedule').checked=state.schedule.enabled;
  const job=state.job;
  $('#job').textContent=job?.status==='running'?`검사 중 ${job.completed}/${job.total} · ${job.symbol||'준비 중'}`:job?.status==='cancelled'?'검사를 중지했어요.':job?.status==='failed'?`검사 실패: ${job.message}`:job?.status==='completed'?'새 검사 결과가 기록됐어요. 검사 기록에서 확인하세요.':state.schedule.enabled?`다음 검사 ${when(state.schedule.nextAt)} · 작업실 실행 중에만 동작`:'';
  if(!run&&state.runs.length){const requested=new URLSearchParams(location.search).get('run');const id=state.runs.some(r=>r.id===requested)?requested:state.runs[0].id;$('#runs').value=id;await load(id);}
}
$('#runs').onchange=()=>load($('#runs').value).catch(fail);
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
$('#scan').onclick=async()=>{try{$('#error').hidden=true;await api('/api/scan',{runId:run.id});await refresh();}catch(e){fail(e);}};
$('#cancel').onclick=async()=>{try{await api('/api/cancel',{});await refresh();}catch(e){fail(e);}};
$('#schedule').onchange=async()=>{try{await api('/api/schedule',{enabled:$('#schedule').checked,runId:run?.id});await refresh();}catch(e){fail(e);}};
refresh().catch(fail);setInterval(()=>refresh().catch(fail),5000);
