import { EXPEDITION_CONNECTION_EVENT, EXPEDITION_TELEMETRY_EVENT } from "../processing/appShell.ts";
import { PROJECT_TELEMETRY_EVENT } from "../processing/projectTelemetry.ts";
import type { Sprint3Session } from "./session.ts";

/** Barramento fornecido pelo host; não cria conexões nem temporizadores. */
export function bindSprint3Session(session: Sprint3Session, target: EventTarget) {
  const telemetry = (event: Event) => session.receive((event as CustomEvent<unknown>).detail);
  const connection = (event: Event) => session.setConnection((event as CustomEvent<unknown>).detail);
  const bindings = [
    [PROJECT_TELEMETRY_EVENT, telemetry], [EXPEDITION_TELEMETRY_EVENT, telemetry],
    [EXPEDITION_CONNECTION_EVENT, connection], ["smart40:connection.state", connection],
  ] as const;
  for (const [name, listener] of bindings) target.addEventListener(name, listener);
  return () => { for (const [name, listener] of bindings) target.removeEventListener(name, listener); };
}
