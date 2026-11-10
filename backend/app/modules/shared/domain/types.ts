export type UUID = string;

/**
 * Identity of the authenticated caller, as the domain sees it. Built from the
 * session user by the controllers; services never read the HTTP context.
 */
export interface ActorContext {
  userId: UUID;
  orgId: UUID | null;
}
