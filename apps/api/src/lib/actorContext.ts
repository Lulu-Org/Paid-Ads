import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

// Who is acting and under which correlation id, for the audit log and domain events
// (Lulu platform architecture, "Actor" and "Correlation"). Set once per request or job and read
// wherever a change is recorded, so no service has to pass it along by hand.

export type ActorType = 'user' | 'ai' | 'system';

export interface ActorContext {
  actorType: ActorType;
  actorId: string | null;
  workspaceId: string | null;
  correlationId: string;
}

const storage = new AsyncLocalStorage<ActorContext>();

/** The current actor, or a system actor when nothing set one (seed scripts, tests). */
export function currentActor(): ActorContext {
  return (
    storage.getStore() ?? {
      actorType: 'system',
      actorId: null,
      workspaceId: null,
      correlationId: randomUUID(),
    }
  );
}

/** Runs `fn` with this actor. Requests start as a system actor until sign-in names the user. */
export function runAs<T>(actor: Partial<ActorContext>, fn: () => T): T {
  return storage.run(
    {
      actorType: actor.actorType ?? 'system',
      actorId: actor.actorId ?? null,
      workspaceId: actor.workspaceId ?? null,
      correlationId: actor.correlationId ?? randomUUID(),
    },
    fn,
  );
}

/** Names the signed-in user for the rest of the request (called by the auth middleware). */
export function setActor(actor: Pick<ActorContext, 'actorType' | 'actorId' | 'workspaceId'>): void {
  const store = storage.getStore();
  if (store) Object.assign(store, actor);
}

// A caller may pass its own correlation id; it must look like an id, not arbitrary text.
const CORRELATION_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export function correlationIdFrom(header: string | undefined): string {
  return header !== undefined && CORRELATION_ID.test(header) ? header : randomUUID();
}
