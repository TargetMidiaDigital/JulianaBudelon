import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Permite acessar o dev server por outras máquinas da rede (IP local) sem o
     Next 15 bloquear assets/HMR por cross-origin. */
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
