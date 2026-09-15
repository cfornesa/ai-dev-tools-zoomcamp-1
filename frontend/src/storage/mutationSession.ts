const SESSION_GENERATION_PREFIX = 'creatrart-mutation-session:';

/** A tab-scoped generation is not a credential; it partitions private queues
 * across sign-in sessions so a later account cannot replay an earlier queue. */
export function getMutationSessionGeneration(ownerId: string): string {
  const key = `${SESSION_GENERATION_PREFIX}${ownerId}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const generation = crypto.randomUUID();
    sessionStorage.setItem(key, generation);
    return generation;
  } catch {
    return `ephemeral-${ownerId}`;
  }
}
