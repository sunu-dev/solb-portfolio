'use client';

import { useSyncExternalStore } from 'react';
import { getServerJoobiCharacter, readJoobiCharacter, subscribeJoobiCharacter } from '@/lib/joobiCharacterPreference';

export function useJoobiCharacter() {
  return useSyncExternalStore(subscribeJoobiCharacter, readJoobiCharacter, getServerJoobiCharacter);
}
