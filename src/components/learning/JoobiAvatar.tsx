'use client';

import Image from 'next/image';
import { getJoobiCharacter, type JoobiCharacter } from '@/config/joobiCharacters';
import { useJoobiCharacter } from '@/hooks/useJoobiCharacter';
import styles from './JoobiAvatar.module.css';

/** Decorative portrait: the adjacent heading or option label supplies the name. */
export function JoobiPortrait({ character, size = 36 }: { character: JoobiCharacter; size?: number }) {
  const selected = getJoobiCharacter(character);
  return <span className={styles.avatar} style={{ width: size, height: size }} aria-hidden="true">
    <Image src={selected.image} alt="" width={size} height={size} sizes={`${size}px`} />
  </span>;
}

export default function JoobiAvatar({ large = false, size }: { large?: boolean; size?: number }) {
  const character = useJoobiCharacter();
  return <JoobiPortrait character={character} size={size ?? (large ? 56 : 36)} />;
}
