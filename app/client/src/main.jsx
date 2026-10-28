import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./shell";
import "./styles.css";
import { z } from "zod";
import { vi } from "zod/locales";
z.config(vi());
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) =>
        ![401, 403, 404, 409, 422].includes(error.status) && count < 1,
      staleTime: 15000,
      refetchOnWindowFocus: true,
    },
  },
});
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
