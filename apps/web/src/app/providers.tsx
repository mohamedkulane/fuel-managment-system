"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 }, mutations: { retry: 0 } } }));
  return (
    <QueryClientProvider client={client}>
      <Toaster
        position="top-right"
        containerClassName="fuel-toast-container"
        toastOptions={{
          duration: 3000,
          success: { duration: 3000 },
          error: { duration: 5000 },
          style: { background: "#003333", color: "#ffffff", border: "1px solid #99CC33", borderRadius: "12px", fontSize: "14px", maxWidth: "min(92vw, 380px)" },
        }}
      />
      {children}
    </QueryClientProvider>
  );
}
