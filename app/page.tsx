import Dashboard from "@/components/Dashboard";

/**
 * Sem backend nesta fase: o app inteiro roda no navegador com dados de exemplo
 * (lib/seed.ts), guardados no localStorage para as edições sobreviverem ao reload.
 */
export default function Home() {
  return <Dashboard />;
}
