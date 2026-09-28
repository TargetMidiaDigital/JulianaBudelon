"use client";

import { apiJson } from "./supabase-browser";

/**
 * Lado do NAVEGADOR da instância Uazapi: chama o proxy /api/whatsapp/instancia (que
 * guarda as credenciais no servidor) e interpreta a resposta, tolerante aos formatos
 * que a Uazapi devolve. Portado de lib/uazapi.ts do CRM do Cachorrão HD.
 */

type Dados = Record<string, unknown>;

export function instanciaAcao(action: "status" | "connect" | "disconnect"): Promise<Dados> {
  return apiJson<Dados>("/api/whatsapp/instancia", "POST", { action });
}

export function uazapiConectada(data: Dados): boolean {
  const instance = data.instance as Dados | undefined;
  const status = data.status as Dados | undefined;
  const instanceStatus = String(instance?.status ?? "").toLowerCase();
  const connectionStatus = String(instance?.connectionStatus ?? "").toLowerCase();
  return data.connected === true || status?.connected === true || instanceStatus === "connected" || instanceStatus === "conectado" || connectionStatus === "open";
}

export function extrairTelefone(data: Dados): string | null {
  const instance = data.instance as Dados | undefined;
  for (const c of [instance?.phone, instance?.number, instance?.owner, data.phone, data.number]) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

export function extrairQr(data: Dados): string | null {
  const instance = data.instance as Dados | undefined;
  for (const c of [instance?.qrcode, data.qrcode, data.qr, data.qr_code]) {
    if (typeof c === "string" && c.trim()) { const qr = c.trim(); return qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`; }
  }
  return null;
}
