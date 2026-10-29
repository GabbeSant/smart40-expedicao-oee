import { adaptProductionOrder, type ProductionOrderAdaptation } from "../adapters/productionOrderAdapter.ts";
import { telemetryMock } from "../mocks/telemetryMock.ts";
import type { OrdemProducao } from "../types/smart40.ts";
import {
  getProductionOrders,
  ProductionOrdersApiError,
  type ProductionOrdersApiOptions,
  type ProductionOrdersPayload,
} from "./productionOrdersApi.ts";

export type ProductionOrdersSnapshot =
  | {
      source: "api";
      adaptations: ProductionOrderAdaptation[];
      originalPayload: ProductionOrdersPayload;
    }
  | {
      source: "mock";
      orders: OrdemProducao[];
      reason: "selected" | "api-failure";
      error?: ProductionOrdersApiError;
    };

/** Porta de leitura independente de React; uma futura origem do Shell pode implementá-la. */
export interface ProductionOrdersSource {
  read(signal?: AbortSignal): Promise<ProductionOrdersSnapshot>;
}

export interface ProductionOrdersSourceOptions {
  mode?: "mock" | "api";
  api?: Omit<ProductionOrdersApiOptions, "signal">;
  fallbackOrders?: readonly OrdemProducao[];
}

/** Mock por padrão. Criar a fonte não inicia rede, timers ou simulação. */
export function createProductionOrdersSource(
  options: ProductionOrdersSourceOptions = {},
): ProductionOrdersSource {
  const fallbackOrders = structuredClone([...(options.fallbackOrders ?? telemetryMock.dadosExpedicao.ordens)]);
  const mock = (error?: ProductionOrdersApiError): ProductionOrdersSnapshot => ({
    source: "mock",
    orders: structuredClone(fallbackOrders),
    reason: error ? "api-failure" : "selected",
    ...(error ? { error } : {}),
  });
  return {
    async read(signal) {
      if (options.mode !== "api") return mock();
      let payload: ProductionOrdersPayload;
      try {
        payload = await getProductionOrders({ ...options.api, signal });
      } catch (error) {
        // Cancelamento deve ser descartado pelo consumidor, sem trocar a origem exibida.
        if (!(error instanceof ProductionOrdersApiError) || error.kind === "cancelled") throw error;
        return mock(error);
      }
      return {
        source: "api",
        adaptations: payload.productionOrders.map(adaptProductionOrder),
        originalPayload: payload,
      };
    },
  };
}
