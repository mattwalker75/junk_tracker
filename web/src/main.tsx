import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./index.css";
import { App } from "./App";
import { applyRememberedTheme } from "./lib/theme";

// the theme this browser used last, before anything else paints
applyRememberedTheme();

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <App />
      {/* on a phone, below the header, so a message never covers the initials menu (review, Nov 22 2026) */}
      <Toaster position="top-center" richColors closeButton mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 76px)" }} />
    </QueryClientProvider>
  </StrictMode>,
);
