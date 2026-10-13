import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { AppShell } from "../components/app-shell";

export const metadata: Metadata = { title: "FuelDesk", description: "Wholesale fuel operations" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  );
}
