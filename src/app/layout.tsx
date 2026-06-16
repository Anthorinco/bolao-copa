import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bolão Copa 2026",
  description: "Bolão simples para a fase de grupos da Copa do Mundo de 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
