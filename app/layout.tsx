import type { Metadata, Viewport } from "next";
import "./globals.css";

// Sem isto o celular renderiza numa viewport virtual de ~980px (zoom-out). Base de
// qualquer responsividade. viewportFit:cover libera as safe-areas do iOS (notch).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Ju Budelon",
  description: "Painel de gestão da Ju Budelon",
  icons: { icon: "/logo-2.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
