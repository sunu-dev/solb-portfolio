'use client';

import Image from 'next/image';
import { getJoobiCharacter, type JoobiCharacter } from '@/config/joobiCharacters';
import { useJoobiCharacter } from '@/hooks/useJoobiCharacter';
import styles from './JoobiAvatar.module.css';

import { JOOBI_REACTIONS, type JoobiMood } from '@/lib/joobiReactions';

/** Decorative portrait: the adjacent heading or option label supplies the name. */
export function JoobiPortrait({ character, size = 36, mood = 'idle' }: { character: JoobiCharacter; size?: number; mood?: JoobiMood }) {
  const selected = getJoobiCharacter(character);
  return <span className={styles.avatar} data-mood={mood} style={{ width: size, height: size }} aria-hidden="true">
    <Image src={selected.image} alt="" width={size} height={size} sizes={`${size}px`} />
    {mood !== 'idle' && <span className={styles.reaction}>{JOOBI_REACTIONS[mood]}</span>}
  </span>;
}

export default function JoobiAvatar({ large = false, size, mood = 'idle' }: { large?: boolean; size?: number; mood?: JoobiMood }) {
  const character = useJoobiCharacter();
  return <JoobiPortrait character={character} size={size ?? (large ? 56 : 36)} mood={mood} />;
}
