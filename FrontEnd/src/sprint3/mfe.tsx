import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Dashboard } from "./Dashboard.tsx";
import css from "./sprint3.css?inline";

let root: Root | null = null;
let style: HTMLStyleElement | null = null;

export async function bootstrap() {}

export async function mount({ domElement }: { domElement: HTMLElement }) {
  style = domElement.ownerDocument.createElement("style");
  style.textContent = css;
  domElement.ownerDocument.head.append(style);
  root = createRoot(domElement);
  root.render(<Dashboard />);
}

export async function unmount() {
  root?.unmount();
  root = null;
  style?.remove();
  style = null;
}
