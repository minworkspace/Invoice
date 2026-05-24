import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoice App",
  description: "Multi-company invoice, quotation, and receipt generator"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
