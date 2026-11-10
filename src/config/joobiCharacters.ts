/** Approved characters only. The full concept archive is kept under artifacts/. */
export const JOOBI_CHARACTERS = [
  { id: 'sprout', name: '새싹', concept: 'F', image: '/illustrations/joobi/sprout-avatar-v1.png' },
  { id: 'dog', name: '강아지', concept: 'D', image: '/illustrations/joobi/dog-avatar-v1.png' },
] as const;

export type JoobiCharacter = (typeof JOOBI_CHARACTERS)[number]['id'];
export const DEFAULT_JOOBI_CHARACTER: JoobiCharacter = 'sprout';

export function isJoobiCharacter(value: unknown): value is JoobiCharacter {
  return JOOBI_CHARACTERS.some(character => character.id === value);
}

export function getJoobiCharacter(value: JoobiCharacter) {
  return JOOBI_CHARACTERS.find(character => character.id === value) ?? JOOBI_CHARACTERS[0];
}
