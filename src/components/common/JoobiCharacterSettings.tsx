'use client';

import { useId, useState } from 'react';
import { DEFAULT_JOOBI_CHARACTER, JOOBI_CHARACTERS, getJoobiCharacter, type JoobiCharacter } from '@/config/joobiCharacters';
import { useJoobiCharacter } from '@/hooks/useJoobiCharacter';
import { saveJoobiCharacter } from '@/lib/joobiCharacterPreference';
import { JoobiPortrait } from '@/components/learning/JoobiAvatar';
import styles from './JoobiCharacterSettings.module.css';

export default function JoobiCharacterSettings() {
  const id = useId();
  const character = useJoobiCharacter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function choose(value: JoobiCharacter) {
    setMessage('');
    if (!saveJoobiCharacter(value)) {
      setError('캐릭터를 저장하지 못했어요. 브라우저의 저장 공간 설정을 확인한 뒤 다시 선택해주세요.');
      return;
    }
    setError('');
    setMessage(`${getJoobiCharacter(value).name} 캐릭터로 바꿨어요.`);
  }

  return <fieldset className={styles.section} aria-describedby={`${id}-help ${id}-storage`}>
    <legend className={styles.title}>주비 캐릭터</legend>
    <p id={`${id}-help`} className={styles.help}>대화에 함께할 주비의 모습을 골라주세요.</p>
    <div className={styles.options}>
      {JOOBI_CHARACTERS.map(option => <label className={styles.option} data-selected={character === option.id} key={option.id}>
        <input type="radio" name={`${id}-character`} value={option.id} checked={character === option.id} onChange={() => choose(option.id)} />
        <JoobiPortrait character={option.id} size={88} />
        <span className={styles.name}>{option.name}</span>
        <span className={styles.caption}>{option.id === DEFAULT_JOOBI_CHARACTER ? '기본 캐릭터' : '선택 캐릭터'}</span>
      </label>)}
    </div>
    <p id={`${id}-storage`} className={styles.help}>선택한 모습은 이 브라우저에 저장돼요.</p>
    <p role="status" className={styles.status}>{message}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </fieldset>;
}
