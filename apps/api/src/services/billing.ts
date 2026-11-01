import type { PaymentMethod, Statement } from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import type { RequestContext } from '../middleware/requestContext';

// Billing is read-only here: card details stay with the payment provider (docs/api.md "billing").

export async function getPaymentMethod(ctx: RequestContext): Promise<PaymentMethod> {
  const row = await scopedDb(ctx.workspaceId).paymentMethod.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  if (row === null) return { status: 'missing', brand: null, last4: null };
  return {
    status: row.status as PaymentMethod['status'],
    brand: row.brand,
    last4: row.last4,
  };
}

export async function listStatements(ctx: RequestContext): Promise<Statement[]> {
  const rows = await scopedDb(ctx.workspaceId).statement.findMany({
    orderBy: [{ month: 'desc' }, { platform: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    month: row.month,
    platform: row.platform,
    amount: { amount: row.amountAmount.toNumber(), currency: row.currency },
    status: row.status as Statement['status'],
    downloadUrl: row.downloadUrl,
  }));
}
