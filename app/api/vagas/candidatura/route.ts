import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { normalizarWhatsapp } from "@/lib/format";
import { unidadeDe, vagaDe, type UnidadeRow, type VagaRow } from "@/lib/data";
import { slugify, unidadeLabel, vagaLabel } from "@/lib/localdb";

/**
 * ROTA PÚBLICA (sem sessão, por design) — o candidato se inscreve pela página /vagas.
 * Cria o talento (status "novo", origem "linkbio") com o currículo no bucket privado
 * `task-anexos` (servido só à equipe pelo /api/anexo).
 *
 * Defesas (é o que substitui o Bearer):
 *  - LIMITE_POR_TELEFONE: no máximo 3 candidaturas em 24h por número → 429.
 *  - Revalidação no servidor: vaga/unidade inexistente ou pausada → 409; arquivo fora
 *    do tipo/tamanho → 400. Só CRIA — nunca lê nem lista candidatos.
 *
 *  POST multipart { nome, whatsapp, vagaId, file } → { ok }
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUCKET = "task-anexos";
const MAX_BYTES = 3 * 1024 * 1024;
const EXT_OK = new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"]);
const LIMITE_POR_TELEFONE = 3;

function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot >= 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "curriculo";
  const ext = (dot >= 0 ? name.slice(dot + 1) : "").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 8).toLowerCase();
  return ext ? `${base}.${ext}` : base;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const nome = String(form?.get("nome") ?? "").trim();
  const whatsapp = String(form?.get("whatsapp") ?? "").trim();
  const vagaId = String(form?.get("vagaId") ?? "").trim();
  const file = form?.get("file");

  if (nome.length < 3) return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
  const digitos = whatsapp.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 11) return NextResponse.json({ error: "Informe o WhatsApp com DDD." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Anexe seu currículo." }, { status: 400 });
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!EXT_OK.has(ext)) return NextResponse.json({ error: "Use PDF, DOC, DOCX, JPG, PNG ou WEBP." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo acima de 3 MB." }, { status: 413 });

  // Vaga e unidade revalidadas no servidor: pausadas entre abrir a página e enviar → 409.
  const { data: vr } = await sb.from("vaga").select("*").eq("id", vagaId).maybeSingle();
  if (!vr) return NextResponse.json({ error: "Vaga não encontrada." }, { status: 409 });
  const vaga = vagaDe(vr as VagaRow);
  if (!vaga.ativa) return NextResponse.json({ error: "Esta vaga não está mais aberta." }, { status: 409 });
  const { data: ur } = await sb.from("unidade").select("*").eq("id", vaga.unidadeId).maybeSingle();
  if (!ur) return NextResponse.json({ error: "Unidade não encontrada." }, { status: 409 });
  const unidade = unidadeDe(ur as UnidadeRow);
  if (!unidade.ativa) return NextResponse.json({ error: "Esta unidade não está recebendo candidaturas." }, { status: 409 });

  // Anti-abuso: o mesmo número não cria mais que N candidaturas em 24h.
  const fone = normalizarWhatsapp(whatsapp);
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await sb.from("talento").select("id", { count: "exact", head: true }).eq("fone", fone).gte("criada", desde);
  if ((count ?? 0) >= LIMITE_POR_TELEFONE) return NextResponse.json({ error: "Você já enviou candidaturas recentemente. Tente novamente amanhã." }, { status: 429 });

  const agora = new Date().toISOString();
  const id = `tal-${slugify(nome).slice(0, 40)}-${Date.now().toString(36)}`;
  const path = `talentos/${id}/${Date.now()}-${safeName(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (up.error) return NextResponse.json({ error: "Não conseguimos guardar o currículo. Tente de novo." }, { status: 500 });

  const row = {
    id, nome, status: "novo", vaga: vaga.titulo, vaga_id: vaga.id, unidade_id: unidade.id, turno: vaga.turno || null,
    fone, qualidade: "Aguardando Análise", origem: "linkbio", criada: agora,
    ultimos_comentarios: [{ id: `c-${Date.now()}`, message: `Candidatura enviada pela página de vagas — ${vagaLabel(vaga)} · ${unidadeLabel(unidade)}.`, author: "sistema", created_at: agora, tipo: "log" }],
    anexos: [{ id: `a-${Date.now()}`, nome: file.name, url: `/api/anexo/${path}`, mime: file.type || undefined, tamanho: file.size, criadoEm: agora }],
  };
  const { error } = await sb.from("talento").insert(row);
  if (error) return NextResponse.json({ error: "Não conseguimos registrar a candidatura. Tente de novo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
