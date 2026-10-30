import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installDemoSimulation } from "./demo/simulate";

if (import.meta.env.RELEASEA_DEMO === "true") {
  installDemoSimulation();
}

createRoot(document.getElementById("root")!).render(<App />);
