import type { MetadataRoute } from "next";

/**
 * Manifesto do app instalável (Chrome/Android "Instalar app", iOS "Adicionar à Tela de
 * Início"): nome "Sistema | JB" e o logo da Juliana Budelon (o mesmo de Configurações →
 * Empresa), em versão redonda e "maskable" (fundo branco, selo na zona segura).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistema | JB",
    short_name: "Sistema JB",
    description: "Painel de gestão da Ju Budelon",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#955C6B",
    lang: "pt-BR",
    icons: [
      { src: "/app-icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icone-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/app-icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
