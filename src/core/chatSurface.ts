/**
 * Backend agent chat POST routes by product surface.
 * History stays on `GET /agents/chat/history/:userId` regardless of surface.
 */
export const CHAT_SURFACES = {
  /** Legacy / generic: `POST /agents/chat` */
  default: {
    chatPath: "/agents/chat",
  },
  /** Qualification / pre-proposal flows */
  preProposal: {
    chatPath: "/agents/pre-proposal/chat",
  },
  /** Proposal / checkout flows */
  postProposal: {
    chatPath: "/agents/post-proposal/chat",
  },
} as const;

export type ChatSurface = keyof typeof CHAT_SURFACES;

export function chatPathFor(surface: ChatSurface = "default"): string {
  return CHAT_SURFACES[surface].chatPath;
}
