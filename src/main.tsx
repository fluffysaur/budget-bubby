import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { refreshExchangeRates } from "./lib/currencyConverter";
import "./index.css";

// Warm the FX cache in the background (no-op if fetched in the last 24h).
void refreshExchangeRates();

const rootElement = document.getElementById("root");
if (rootElement) {
    createRoot(rootElement).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}
