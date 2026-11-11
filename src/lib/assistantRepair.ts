/** A single regeneration uses the original verified packet, never a rejected answer as evidence. */
export function assistantRepairPrompt(prompt: string, contextIssue?: string): string {
  return `${prompt}
[최종 표현 검사에 따른 재작성]
${contextIssue === 'invented_question_premise' ? '이번 질문은 하락이나 상승을 단정하지 않았어요. 질문이 틀렸다는 정정을 하지 말고 실제 움직임과 이유를 설명하세요.' : contextIssue === 'event_identity' ? '공개 기사에서 말하는 선거 종류를 그대로 유지하세요. 중간선거를 대통령 선거로 바꾸지 마세요.' : contextIssue === 'missing_unconfirmed_cause' || contextIssue === 'unsourced_cause' || contextIssue === 'unsourced_insight' ? '이번 자료에는 이 움직임을 설명하는 기사 본문이 없어요. 원인을 말하거나 \'때문에·영향으로·덕분에\'로 문장을 잇지 마세요. 가격이 어떻게 움직였는지, 시장·업종 가격과 비교하면 어떤지, 그리고 \'왜 움직였는지는 확인하지 못했어요\'라는 한 문장만 쓰세요. keyAdvice와 assistantInsights는 []로 두세요.' : contextIssue === 'relative_election_time' ? '기사의 급락일을 선거일로 옮기지 마세요. 선거 결과와 주가 반응을 구분하고, 확인하지 못한 사건 날짜는 붙이지 마세요. 사건 날짜가 필요하면 본문에 있는 절대 날짜만 쓰세요.' : ''}
같은 질문과 위 공개 자료로 답변을 한 번 다시 작성하세요. 새 사실을 추가하거나 거래 행동을 권하지 마세요.
매수·매도·보유·물타기 같은 행동과 '추천·고려·하세요·좋아요·유리'를 연결하지 마세요. 무엇을 하라는 지시 대신, 돈을 더 넣을 때 부담이 어떻게 달라지는지와 확인되지 않은 사실을 설명하세요.
가격이 싼지 비싼지 판정하거나 저평가·고평가라고 쓰지 마세요. 상승·반등 확률이나 목표 가격도 만들지 마세요.
같은 근거 ID와 사실 검증 기준을 지키세요. 인용 기사의 의견은 기사 의견으로 구분하고, 본문은 최대 5문장으로 질문에 직접 답하세요. 검사나 재작성 과정은 사용자에게 설명하지 마세요. 위 JSON 형식을 그대로 사용하세요.`;
}
