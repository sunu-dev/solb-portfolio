const referenceList={type:'array',items:{type:'string',pattern:'^p[0-9]+$'},maxItems:12};
export const NARRATIVE_SCHEMAS={
 draft:{type:'object',additionalProperties:false,required:['hypotheses'],properties:{hypotheses:{type:'array',maxItems:2,items:{type:'object',additionalProperties:false,
  required:['id','entityId','summary','pathway','support','counterEvidence'],properties:{id:{type:'string',enum:['h1','h2','h3']},entityId:{type:'string'},summary:{type:'string',minLength:10,maxLength:350,pattern:'^[^0-9<>%$₩]+$'},
   pathway:{type:'string',enum:['earnings_outlook','cash_investment','demand_supply']},support:{...referenceList,minItems:1},counterEvidence:referenceList}}}}},
 review:{type:'object',additionalProperties:false,required:['inputHash','hypothesesHash','reviewedPassages','reviews'],properties:{inputHash:{type:'string'},hypothesesHash:{type:'string'},
  reviewedPassages:{type:'array',items:{type:'string'},maxItems:30},reviews:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,
   required:['id','verdict','sourceSupport','pathwaySupport','scopeCorrect','counterEvidence','counterResolutions','reason'],properties:{id:{type:'string',enum:['h1','h2','h3']},
    verdict:{type:'string',enum:['supported','unsupported','conflicting']},sourceSupport:{type:'boolean'},pathwaySupport:{type:'boolean'},scopeCorrect:{type:'boolean'},counterEvidence:referenceList,counterResolutions:{type:'array',maxItems:12,items:{type:'object',additionalProperties:false,required:['passageId','relation','reason'],properties:{passageId:{type:'string',pattern:'^p[0-9]+$'},relation:{type:'string',enum:['contradicts','general_risk','unrelated']},reason:{type:'string',minLength:1,maxLength:350}}}},reason:{type:'string',minLength:1,maxLength:350}}}}}},
} as const;

export interface ReviewBinding {inputHash:string;hypothesesHash:string;passageIds:string[];hypothesisIds:string[];}
/** Bind the structured response to this request. Echoed IDs are a format check,
 * not proof that a model understood every passage; semantic evaluation is separate. */
export function boundReviewSchema(binding:ReviewBinding):Record<string,unknown>{
 if(!/^[0-9a-f]{64}$/.test(binding.inputHash)||!/^[0-9a-f]{64}$/.test(binding.hypothesesHash)||!binding.passageIds.length||binding.passageIds.length>30
  ||new Set(binding.passageIds).size!==binding.passageIds.length||binding.passageIds.some(id=>!/^p\d+$/.test(id))
  ||!binding.hypothesisIds.length||binding.hypothesisIds.length>3||new Set(binding.hypothesisIds).size!==binding.hypothesisIds.length
  ||binding.hypothesisIds.some(id=>!/^h[1-3]$/.test(id)))throw new Error('invalid_review_binding');
 const schema=NARRATIVE_SCHEMAS.review;
 return {...schema,properties:{...schema.properties,inputHash:{type:'string',enum:[binding.inputHash]},hypothesesHash:{type:'string',enum:[binding.hypothesesHash]},
  reviewedPassages:{type:'array',items:{type:'string',enum:binding.passageIds},minItems:binding.passageIds.length,maxItems:binding.passageIds.length},
  reviews:{...schema.properties.reviews,minItems:binding.hypothesisIds.length,maxItems:binding.hypothesisIds.length,
   items:{...schema.properties.reviews.items,properties:{...schema.properties.reviews.items.properties,id:{type:'string',enum:binding.hypothesisIds}}}}}};
}
