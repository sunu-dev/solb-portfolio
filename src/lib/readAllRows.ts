/** Keyset pagination avoids Supabase's 1,000-row default and offset drift. */
export async function readAllRows<T>(page: (after: string | number | null) => PromiseLike<{ data: T[] | null; error: unknown }>, key: (row: T) => string | number): Promise<T[]> {
  const rows: T[] = [];
  let after: string | number | null = null;
  for (;;) {
    const res = await page(after);
    if (res.error) throw res.error;
    const batch = res.data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
    if (rows.length >= 200000) throw new Error('Analytics volume requires database aggregation');
    after = key(batch[batch.length-1]);
  }
}

/** Stable ordered queries with a bounded snapshot; errors never become empty charts. */
export async function readAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[] }> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await page(offset, offset + 999);
    if (res.error) throw res.error;
    const batch = res.data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return { data: rows };
    if (rows.length >= 200000) throw new Error('Analytics volume requires database aggregation');
  }
}
