/** Tipos observados na amostra da Planta N2; campos ausentes não recebem defaults. */
export interface ProductionOrderProcessDto {
  productionOrderProcessId?: number | null;
  processingTime?: number | null;
  [field: string]: unknown;
}

export interface ProductionOrderParameterDto {
  key?: string | null;
  value?: string | null;
  [field: string]: unknown;
}

export interface ProductionOrderDto {
  id?: number | null;
  code?: string | null;
  productCode?: string | null;
  trackingCode?: string | null;
  productName?: string | null;
  priority?: number | null;
  dueDate?: string | null;
  plannedStartTime?: string | null;
  plannedFinishTime?: string | null;
  startTime?: string | null;
  finishTime?: string | null;
  sequenceNumber?: number | null;
  productionOrderStatusId?: number | null;
  productionLineId?: number | null;
  processes?: ProductionOrderProcessDto[] | null;
  parameters?: ProductionOrderParameterDto[] | null;
  [field: string]: unknown;
}

export interface ProductionOrdersPayload {
  productionOrders: ProductionOrderDto[];
  productionLineId?: number | null;
  [field: string]: unknown;
}

export const PRODUCTION_ORDERS_BASE_URL = "http://192.168.150.200:5678";
export const PRODUCTION_ORDERS_PATH = "/api/productionOrders";

export type ProductionOrdersErrorKind =
  | "configuration"
  | "unavailable"
  | "http"
  | "invalid-payload"
  | "timeout"
  | "cancelled";

export class ProductionOrdersApiError extends Error {
  readonly kind: ProductionOrdersErrorKind;
  readonly status?: number;

  constructor(kind: ProductionOrdersErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ProductionOrdersApiError";
    this.kind = kind;
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown) => typeof value === "string";
const isNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);
const optional = (value: unknown, check: (value: unknown) => boolean) =>
  value === undefined || value === null || check(value);

function isProductionOrder(value: unknown): value is ProductionOrderDto {
  if (!isRecord(value)) return false;
  return (
    [
      "code", "productCode", "trackingCode", "productName", "dueDate",
      "plannedStartTime", "plannedFinishTime", "startTime", "finishTime",
    ].every((key) => optional(value[key], isText)) &&
    [
      "id", "priority", "sequenceNumber", "productionOrderStatusId", "productionLineId",
    ].every((key) => optional(value[key], isNumber)) &&
    optional(value.processes, (items) =>
      Array.isArray(items) && items.every((item) =>
        isRecord(item) &&
        optional(item.productionOrderProcessId, isNumber) &&
        optional(item.processingTime, isNumber),
      ),
    ) &&
    optional(value.parameters, (items) =>
      Array.isArray(items) && items.every((item) =>
        isRecord(item) && optional(item.key, isText) && optional(item.value, isText),
      ),
    )
  );
}

/** Valida estrutura e tipos, sem interpretar status, datas ou parâmetros. */
export function parseProductionOrdersPayload(value: unknown): ProductionOrdersPayload {
  if (
    !isRecord(value) ||
    !Array.isArray(value.productionOrders) ||
    !value.productionOrders.every(isProductionOrder) ||
    !optional(value.productionLineId, isNumber)
  ) {
    throw new ProductionOrdersApiError(
      "invalid-payload",
      "Resposta inválida: esperado um objeto com productionOrders e tipos compatíveis com a amostra.",
    );
  }
  return value as ProductionOrdersPayload;
}

export interface ProductionOrdersApiOptions {
  /** Origem HTTP(S), sem caminho, credenciais, query ou fragmento. */
  baseUrl?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

function endpoint(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/"
    ) throw new Error("Origem inválida");
    return new URL(PRODUCTION_ORDERS_PATH, url.origin).href;
  } catch {
    throw new ProductionOrdersApiError(
      "configuration",
      "Informe somente a origem HTTP(S) da API, sem credenciais.",
    );
  }
}

/** Única operação de rede desta camada: GET /api/productionOrders. */
export async function getProductionOrders(
  options: ProductionOrdersApiOptions = {},
): Promise<ProductionOrdersPayload> {
  const url = endpoint(options.baseUrl ?? PRODUCTION_ORDERS_BASE_URL);
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new ProductionOrdersApiError("configuration", "Timeout deve ser positivo e finito.");
  }
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    if (controller.signal.aborted) throw new Error("Consulta cancelada");
    const response = await (options.fetchImpl ?? globalThis.fetch)(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ProductionOrdersApiError("http", `API respondeu HTTP ${response.status}.`, response.status);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (controller.signal.aborted) throw new Error("Consulta interrompida");
      throw new ProductionOrdersApiError("invalid-payload", "A API não retornou JSON válido.");
    }
    return parseProductionOrdersPayload(payload);
  } catch (error) {
    if (timedOut) throw new ProductionOrdersApiError("timeout", "Tempo limite da consulta excedido.");
    if (options.signal?.aborted) throw new ProductionOrdersApiError("cancelled", "Consulta cancelada.");
    if (error instanceof ProductionOrdersApiError) throw error;
    throw new ProductionOrdersApiError("unavailable", "Não foi possível consultar a API de ordens.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
