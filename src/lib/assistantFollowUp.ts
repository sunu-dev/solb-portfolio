export type AssistantFollowUpStyle = 'simpler' | 'example';

/** Only a standalone rewrite request: naming a new topic must still retrieve its own evidence. */
export function assistantFollowUpStyleText(input: string): AssistantFollowUpStyle | null {
  const text = input.replace(/\s+/g, '').replace(/[.!?。？！,，]/g, '')
    .replace(/^(?:아직|조금|좀)?(?:어려워요?|어렵네|이해가안돼요?|이해가안되네)/, '')
    .replace(/^(?:그럼|그러면)/, '');
  const ending = '(?:설명(?:해줘|해주세요|해줄래|해줄래요)|말해줘|알려줘|알려주세요)';
  const firstCheck = '(?:내가)?먼저확인할것부터';
  if (new RegExp(`^(?:좀)?(?:예를(?:하나)?들어(?:서)?|예시로)(?:${firstCheck})?${ending}$`).test(text)) return 'example';
  if (new RegExp(`^(?:좀)?(?:더)?(?:쉽게|쉬운말로)(?:${firstCheck})?${ending}$`).test(text)) return 'simpler';
  return null;
}
