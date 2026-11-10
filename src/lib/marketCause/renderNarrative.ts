import { PATHWAYS,type NarrativeAssessment,type NarrativePacket } from './narrativeReview';
/** Internal review preview only. No public route imports this renderer. */
export function renderNarrativePreview(assessment:NarrativeAssessment,packet:NarrativePacket){
 if(assessment.inputHash!==packet.inputHash||assessment.publicEligible!==false)throw new Error('narrative_packet_mismatch');
 return {label:'비공개 검증 · 회사 발표에서 확인할 배경',state:assessment.status,
  scope:'제공된 회사 발표 문단에 한정한 검토이며, 시장 전체 또는 당일 주가 변동 원인을 확정한 결과가 아니에요.',
  items:assessment.hypotheses.map(h=>({id:h.id,entityId:h.entityId,summary:h.summary,...PATHWAYS[h.pathway],
   sources:[...new Set([...h.support,...h.counterEvidence].map(key=>packet.passages[key].documentId))]})),
  coverage:{reviewed:assessment.reviewedPassages,omitted:assessment.omittedPassages},publicEligible:false as const};
}
