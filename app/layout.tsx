import type { Metadata, Viewport } from "next";
import "./globals.css";

// Sem isto o celular renderiza numa viewport virtual de ~980px (zoom-out). Base de
// qualquer responsividade. viewportFit:cover libera as safe-areas do iOS (notch).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#955C6B",
};

export const metadata: Metadata = {
  title: "Sistema | JB",
  description: "Painel de gestão da Ju Budelon",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      {/* App instalável e ícones escritos direto no <head>: o Next 15 "transmite" os metadados
          e eles acabavam no <body>, onde o Chrome (manifesto) e o Safari (ícone da Tela de
          Início) não leem. Logo do cliente (o mesmo de Configurações → Empresa). */}
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icone-jb.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icone-jb-180.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Sistema JB" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>{children}</body>
    </html>
  );
}
