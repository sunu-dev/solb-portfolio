import type { SupabaseClient } from '@supabase/supabase-js';
import { parseDictionary, type DictionaryEntry } from './personalDictionary';
import { withDeadline } from './withDeadline';

async function dictionaryRequest<T>(request: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  try { return await withDeadline(Promise.resolve(request(controller.signal)), 6000); }
  finally { controller.abort(); }
}

export async function readCloudDictionary(client: SupabaseClient, owner: string): Promise<DictionaryEntry[]> {
  const { data, error } = await dictionaryRequest(signal => client.from('personal_dictionary').select('entry,revision').eq('user_id', owner).order('updated_at', { ascending: false }).limit(300).abortSignal(signal));
  if (error || !data) throw new Error('dictionary_read_failed');
  return data.flatMap(row => parseDictionary(JSON.stringify([row.entry])).map(entry => ({ ...entry, revision: row.revision })));
}
/** Compare-and-set prevents a stale tab from overwriting newer notes or resurrecting deleted terms. */
export async function writeCloudDictionary(client: SupabaseClient, owner: string, entry: DictionaryEntry): Promise<boolean> {
  const { revision, ...payload } = entry;
  const query = typeof revision === 'number'
    ? client.from('personal_dictionary').update({ entry: payload }).eq('user_id', owner).eq('id', entry.id).eq('revision', revision)
    : client.from('personal_dictionary').insert({ user_id: owner, id: entry.id, entry: payload });
  const { data, error } = await dictionaryRequest(signal => query.select('id').abortSignal(signal));
  return !error && data?.length === 1;
}
export async function deleteCloudDictionary(client: SupabaseClient, owner: string, entry: DictionaryEntry): Promise<boolean> {
  if (typeof entry.revision !== 'number') return false;
  const { data, error } = await dictionaryRequest(signal => client.from('personal_dictionary').delete().eq('user_id', owner).eq('id', entry.id).eq('revision', entry.revision).select('id').abortSignal(signal));
  return !error && data?.length === 1;
}
