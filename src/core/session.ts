export type AnonymousIdOptions = {
  prefix?: string;
};

const DEFAULT_PREFIX = "anon_";

/** Matches documented pattern: prefix + random + time. */
export function generateAnonymousId(options?: AnonymousIdOptions): string {
  const prefix = options?.prefix ?? DEFAULT_PREFIX;
  const rand = Math.random().toString(36).slice(2, 11);
  return `${prefix}${Date.now()}_${rand}`;
}

export function buildSessionId(params: {
  userId: string | null;
  anonymousId: string;
  sessionIdSuffix: string;
}): string {
  const base = params.userId?.trim() || params.anonymousId;
  return `${base}${params.sessionIdSuffix}`;
}
