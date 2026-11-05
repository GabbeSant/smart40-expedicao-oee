import type { ProductionOrderDto } from '../integration/productionOrdersApi.ts';

/** DB9.I30 contém o número usado em OP{numero}, não a chave id da API. */
export function resolveN2ProductionOrder(plcOrderNumber: unknown, orders: readonly ProductionOrderDto[]): {
  status: 'matched' | 'no-order' | 'not-found' | 'ambiguous';
  trackingCode: string | null;
  productionOrderId: string | null;
} {
  if (!Number.isSafeInteger(plcOrderNumber) || (plcOrderNumber as number) < 0)
    throw new Error('Número de OP do CLP inválido');
  if (plcOrderNumber === 0) return { status: 'no-order', trackingCode: null, productionOrderId: null };
  const trackingCode = `OP${plcOrderNumber}`;
  const matches = orders.filter(order => (order.trackingCode?.trim() || order.code?.trim()) === trackingCode);
  if (matches.length !== 1) return { status: matches.length ? 'ambiguous' : 'not-found', trackingCode, productionOrderId: null };
  const order = matches[0];
  if (order.id != null && (!Number.isSafeInteger(order.id) || order.id <= 0)) throw new Error('Identificador da API inválido');
  return { status: 'matched', trackingCode, productionOrderId: order.id == null ? trackingCode : String(order.id) };
}
