import type { QueryClient } from '@tanstack/react-query';
import { api, type Schemas } from './client';
import { unwrap } from './http';
import { queryKeys } from './queries';

/**
 * Turns tag names into ids, creating the names that do not exist yet (matched without case).
 * The tag list is refreshed whenever one was created, so a retry does not try to create it again.
 */
export async function ensureTagIds(
  names: string[],
  existing: Schemas['TagResponse'][],
  queryClient: QueryClient,
): Promise<number[]> {
  const byName = new Map(existing.map((tag) => [tag.name.toLowerCase(), tag.id]));
  const ids: number[] = [];
  let created = false;
  try {
    for (const name of names) {
      const key = name.trim().toLowerCase();
      let id = byName.get(key);
      if (id === undefined) {
        id = (await unwrap(api.POST('/api/v1/tags', { body: { name: name.trim() } }))).id;
        byName.set(key, id);
        created = true;
      }
      if (!ids.includes(id)) ids.push(id);
    }
  } finally {
    if (created) await queryClient.invalidateQueries({ queryKey: queryKeys.tags });
  }
  return ids;
}
