import type { OrdemProducao } from "../types/smart40.ts";
import type { ProductionOrderDto } from "../integration/productionOrdersApi.ts";

export interface ProductionOrderAdaptation {
  /** Somente os campos com equivalência segura; não é uma OrdemProducao completa. */
  mapped: Partial<Pick<OrdemProducao, "codigo" | "produto">>;
  pendingFields: (keyof OrdemProducao)[];
  /** Inclui campos desconhecidos, parâmetros e valores nulos sem coerção. */
  original: ProductionOrderDto;
}

/** Não completa lacunas com zeros, status deduzido ou dados de uma ordem mock. */
export function adaptProductionOrder(order: ProductionOrderDto): ProductionOrderAdaptation {
  const mapped: ProductionOrderAdaptation["mapped"] = {};
  const pendingFields: (keyof OrdemProducao)[] = [];
  if (typeof order.code === "string" && order.code.trim()) mapped.codigo = order.code;
  else pendingFields.push("codigo");
  if (typeof order.productName === "string" && order.productName.trim()) mapped.produto = order.productName;
  else pendingFields.push("produto");
  pendingFields.push("meta", "produzido", "status", "destino");
  return { mapped, pendingFields, original: structuredClone(order) };
}
