import type { Metadata } from "next";
import "./globals.css";
export const dynamic='force-dynamic';

export const metadata: Metadata = {
  title: "NEXO · Gestão multicanal",
  description: "Seu estoque, suas vendas e sua próxima decisão. Tudo conectado.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
