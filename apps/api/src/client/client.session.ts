export interface ClientSession {
  requestId: string;
  workspaceId: string;
}
export const CODE_TTL_SEC = 10 * 60;
export const CODE_MAX_ATTEMPTS = 5;
export const CODES_PER_HOUR = 5;
/** Sliding: renewed on every request while the client is active. */
export const SESSION_TTL_SEC = 2 * 60 * 60;
