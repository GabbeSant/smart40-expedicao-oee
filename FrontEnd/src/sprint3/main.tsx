import { createRoot } from "react-dom/client";
import { Dashboard } from "./Dashboard.tsx";
import "../styles/theme.css";
import "./sprint3.css";

createRoot(document.getElementById("root")!).render(<Dashboard standalone />);
