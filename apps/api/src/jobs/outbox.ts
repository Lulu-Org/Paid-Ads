import { db } from '../db/prisma';
import { Prisma } from '../generated/prisma/client';

// Publishes the domain events db/audit.ts writes to the outbox. Delivery is at least once, so
// listeners must be idempotent (use the event id). Listeners are in-process for now; when Lulu's
// platform event bus exists, it becomes one more listener here and nothing else changes.

export interface DomainEvent {
  id: string;
  workspaceId: string;
  eventType: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string | null;
  actorType: 'user' | 'ai' | 'system';
  actorId: string | null;
  correlationId: string;
  payload: unknown;
  occurredAt: Date;
}

type Listener = (event: DomainEvent) => Promise<void> | void;

const listeners = new Map<string, Set<Listener>>();
export const MAX_ATTEMPTS = 5;
const DISPATCH_EVERY_MS = 2000;

/** Listens to one event type, or to every event with "*". Returns a function that stops listening. */
export function onDomainEvent(eventType: string, listener: Listener): () => void {
  const set = listeners.get(eventType) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(eventType, set);
  return () => set.delete(listener);
}

type Claimed = DomainEvent & { attempts: number };

/**
 * Claims up to `limit` pending events (oldest first; SKIP LOCKED so several API instances can run
 * this at once), hands each to its listeners, and marks it dispatched. A failing event is retried on
 * the next run and parked as failed after MAX_ATTEMPTS. Returns how many events were dispatched.
 */
// `workspaceId` limits a run to one workspace (replaying one customer's events, or a test).
export async function dispatchOutbox(limit = 100, workspaceId?: string): Promise<number> {
  const scope =
    workspaceId === undefined ? Prisma.empty : Prisma.sql`AND "workspaceId" = ${workspaceId}`;
  const claimed = await db.$queryRaw<Claimed[]>`
    UPDATE outbox_events SET attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM outbox_events WHERE status = 'pending' ${scope}
      ORDER BY "occurredAt", id LIMIT ${limit} FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "workspaceId", "eventType", "schemaVersion", "aggregateType", "aggregateId",
      "actorType"::text AS "actorType", "actorId", "correlationId", payload, "occurredAt", attempts`;

  let dispatched = 0;
  for (const event of claimed.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    const targets = [...(listeners.get(event.eventType) ?? []), ...(listeners.get('*') ?? [])];
    try {
      for (const listener of targets) await listener(event);
      await db.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'dispatched', dispatchedAt: new Date(), lastError: null },
      });
      dispatched += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          lastError: message.slice(0, 500),
          ...(event.attempts >= MAX_ATTEMPTS ? { status: 'failed' as const } : {}),
        },
      });
    }
  }
  return dispatched;
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startOutboxDispatcher(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    dispatchOutbox()
      .catch((error: unknown) =>
        console.error(
          `[outbox] dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      .finally(() => {
        running = false;
      });
  }, DISPATCH_EVERY_MS);
  timer.unref();
}

export function stopOutboxDispatcher(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
