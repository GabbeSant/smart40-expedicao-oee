import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { Root } from "react-dom/client";
import { Dashboard } from "./Dashboard.tsx";
import type { ResetEntry } from "./session.ts";
import css from "./sprint3.css?inline";

let root: Root | null = null;
let host: HTMLElement | null = null;

export async function bootstrap() {}

export async function mount({ domElement, onReset }: { domElement: HTMLElement; onReset?: (entry: ResetEntry) => void }) {
  if (!domElement || domElement.ownerDocument.defaultView !== window) throw new Error("Informe domElement no documento do App Shell.");
  if (root) throw new Error("Sprint 3 já montada. Execute unmount antes de montar novamente.");
  host = domElement.ownerDocument.createElement("div");
  host.dataset.smart40Module = "expedition-sprint3";
  const shadow = host.attachShadow({ mode: "open" });
  const style = domElement.ownerDocument.createElement("style");
  style.textContent = css;
  const container = domElement.ownerDocument.createElement("div");
  shadow.append(style, container);
  domElement.append(host);
  root = createRoot(container);
  flushSync(() => root!.render(<Dashboard onReset={onReset} />));
}

export async function unmount() {
  root?.unmount();
  root = null;
  host?.remove();
  host = null;
}
