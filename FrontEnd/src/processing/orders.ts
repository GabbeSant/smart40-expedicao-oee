import { getProductionOrders, type ProductionOrdersApiOptions, type ProductionOrdersPayload } from "../integration/productionOrdersApi.ts";
import type { OrderRecord } from "./contracts.ts";
import type { ExpeditionProcessor } from "./processor.ts";

/** Reaproveita a API da branch teste; campos sem equivalência permanecem nulos. */
export function adaptOrderCatalog(payload: ProductionOrdersPayload): OrderRecord[] {
  return payload.productionOrders.map(order => {
    const id = order.id !== null && order.id !== undefined ? String(order.id) : order.code?.trim();
    if (!id) throw new Error("Ordem sem id ou código não pode ser associada às peças");
    if (order.productionOrderStatusId != null && order.status_id != null && order.productionOrderStatusId !== order.status_id)
      throw new Error('Campos de status da ordem são conflitantes');
    return {
      id, code: order.code?.trim() || null, product: order.productName?.trim() || null,
      sourceStatusId: order.productionOrderStatusId ?? order.status_id ?? null,
      plannedQuantity: null, destination: null,
    };
  });
}

/** Falha de rede preserva o catálogo anterior; não troca dados reais por mocks. */
export async function refreshProductionOrders(processor: ExpeditionProcessor, options: ProductionOrdersApiOptions = {}) {
  const payload = await getProductionOrders(options);
  const orders = adaptOrderCatalog(payload);
  processor.replaceOrders(orders);
  return { orders, originalPayload: payload };
}
