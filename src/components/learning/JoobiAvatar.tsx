'use client';

import Image from 'next/image';
import { getJoobiCharacter, type JoobiCharacter } from '@/config/joobiCharacters';
import { useJoobiCharacter } from '@/hooks/useJoobiCharacter';
import styles from './JoobiAvatar.module.css';

export type JoobiMood = 'idle' | 'hello' | 'searching' | 'thinking' | 'ready' | 'retry';

/** Decorative portrait: the adjacent heading or option label supplies the name. */
export function JoobiPortrait({ character, size = 36, mood = 'idle' }: { character: JoobiCharacter; size?: number; mood?: JoobiMood }) {
  const selected = getJoobiCharacter(character);
  return <span className={styles.avatar} data-mood={mood} style={{ width: size, height: size }} aria-hidden="true">
    <Image src={selected.image} alt="" width={size} height={size} sizes={`${size}px`} />
    {mood !== 'idle' && <span className={styles.reaction}>{mood === 'searching' ? '?' : mood === 'thinking' ? '…' : mood === 'retry' ? '↻' : '✦'}</span>}
  </span>;
}

export default function JoobiAvatar({ large = false, size, mood = 'idle' }: { large?: boolean; size?: number; mood?: JoobiMood }) {
  const character = useJoobiCharacter();
  return <JoobiPortrait character={character} size={size ?? (large ? 56 : 36)} mood={mood} />;
}
