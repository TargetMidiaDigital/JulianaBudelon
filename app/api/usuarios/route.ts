import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireSession, findAuthUserByEmail } from "@/lib/auth-admin";
import { localSlug } from "@/lib/selectors";
import { CARGOS, corDoCargo } from "@/lib/acesso";
import { teamDe, type UsuarioRow } from "@/lib/data";
import type { Cargo, TeamMember } from "@/lib/types";

/**
 * Pessoas (Configurações → Pessoas / Perfil).
 *  - POST  { nome, email, cargo, senha } → cria o login no Supabase Auth (já confirmado)
 *    + a linha em `usuarios`. Só Administrador. Devolve { user } com o id gerado.
 *  - PATCH { id, patch } → edita nome / cargo / cor / foto / WhatsApp / ativo / e-mail /
 *    senha. Administrador edita qualquer pessoa; os demais só a PRÓPRIA foto e senha.
 */
export const dynamic = "force-dynamic";

function initials(nome: string): string {
  const p = nome.trim().split(/\s+/);
  const a = p[0]?.[0] ?? "";
  const b = p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] ?? "");
  return (a + b).toUpperCase() || "?";
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireSession(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  if (sess.cargo !== "Administrador") return NextResponse.json({ error: "Apenas Administrador pode criar pessoas." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { nome?: string; email?: string; cargo?: string; senha?: string };
  const nome = (body.nome ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const cargo = body.cargo as Cargo;
  const senha = body.senha ?? "";
  if (!nome) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  if (!CARGOS.includes(cargo)) return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
  if (senha.length < 6) return NextResponse.json({ error: "A senha precisa ter ao menos 6 caracteres." }, { status: 400 });
  const { data: dup } = await sb.from("usuarios").select("id").eq("email", email).maybeSingle();
  if (dup) return NextResponse.json({ error: "Já existe uma pessoa com este e-mail." }, { status: 400 });

  // 1) login (já confirmado, pode entrar de imediato)
  const { data: created, error: createErr } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (createErr || !created?.user) return NextResponse.json({ error: createErr?.message || "Falha ao criar o login (e-mail já existe?)." }, { status: 400 });

  // 2) linha em `usuarios` (id slug único). Se falhar, desfaz o login.
  let id = localSlug(nome) || email.split("@")[0];
  for (let t = 0; t < 4; t++) {
    const { data: exists } = await sb.from("usuarios").select("id").eq("id", id).maybeSingle();
    if (!exists) break;
    id = `${localSlug(nome)}-${Math.random().toString(36).slice(2, 5)}`;
  }
  const row = { id, nome, email, cargo, ini: initials(nome), cor: corDoCargo(cargo), ativo: true };
  const { error: insErr } = await sb.from("usuarios").insert(row);
  if (insErr) {
    await sb.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }
  const user: TeamMember = { id, nome, email, cargo, ini: row.ini, cor: row.cor, ativo: true };
  return NextResponse.json({ ok: true, user });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireSession(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const isAdmin = sess.cargo === "Administrador";

  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<TeamMember> & { senha?: string } };
  if (!id || !patch) return NextResponse.json({ error: "id e patch obrigatórios." }, { status: 400 });

  const cols: Record<string, unknown> = {};
  let emailNovo: string | undefined;
  let senhaNova: string | undefined;
  if (typeof patch.nome === "string" && patch.nome.trim()) { cols.nome = patch.nome.trim(); cols.ini = initials(patch.nome); }
  if (typeof patch.ini === "string" && patch.ini.trim()) cols.ini = patch.ini.trim().toUpperCase();
  if (typeof patch.cargo === "string") {
    if (!CARGOS.includes(patch.cargo as Cargo)) return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
    cols.cargo = patch.cargo;
  }
  if (typeof patch.cor === "string") cols.cor = patch.cor;
  if ("whatsapp" in patch) cols.whatsapp = patch.whatsapp || null;
  if ("whatsappInterno" in patch) cols.whatsapp_interno = patch.whatsappInterno || null;
  if ("foto" in patch) cols.foto = patch.foto || null;
  if (typeof patch.ativo === "boolean") cols.ativo = patch.ativo;
  if (typeof patch.email === "string") {
    const em = patch.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    emailNovo = em;
  }
  if (typeof patch.senha === "string" && patch.senha) {
    if (patch.senha.length < 6) return NextResponse.json({ error: "A senha precisa ter ao menos 6 caracteres." }, { status: 400 });
    senhaNova = patch.senha;
  }
  if (!Object.keys(cols).length && !emailNovo && !senhaNova) return NextResponse.json({ persisted: true });

  // Não-admin: só a própria foto e a própria senha.
  if (!isAdmin) {
    const soPermitido = !emailNovo && Object.keys(cols).every((k) => k === "foto");
    if (!soPermitido || sess.userId !== id) return NextResponse.json({ error: "Sem permissão para editar." }, { status: 403 });
  }

  const { data: pessoa } = await sb.from("usuarios").select("*").eq("id", id).maybeSingle();
  if (!pessoa) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  const emailAtual = ((pessoa as UsuarioRow).email ?? "").toLowerCase();

  // E-mail é a identidade de login: atualiza o Auth junto (se a pessoa tiver login).
  if (emailNovo && emailNovo !== emailAtual) {
    const { data: dup } = await sb.from("usuarios").select("id").eq("email", emailNovo).neq("id", id).maybeSingle();
    if (dup) return NextResponse.json({ error: "Já existe uma pessoa com este e-mail." }, { status: 400 });
    const authUser = emailAtual ? await findAuthUserByEmail(sb, emailAtual) : null;
    if (authUser) {
      const { error: aErr } = await sb.auth.admin.updateUserById(authUser.id, { email: emailNovo, email_confirm: true });
      if (aErr) return NextResponse.json({ error: `Falha ao atualizar o login: ${aErr.message}` }, { status: 400 });
    }
    cols.email = emailNovo;
  }

  if (senhaNova) {
    const alvo = emailNovo ?? emailAtual;
    if (!alvo) return NextResponse.json({ error: "Pessoa sem e-mail — não há login para trocar a senha." }, { status: 400 });
    const authUser = await findAuthUserByEmail(sb, alvo);
    if (!authUser) return NextResponse.json({ error: `Não existe login para ${alvo}.` }, { status: 400 });
    const { error: sErr } = await sb.auth.admin.updateUserById(authUser.id, { password: senhaNova });
    if (sErr) return NextResponse.json({ error: `Falha ao trocar a senha: ${sErr.message}` }, { status: 400 });
  }

  if (Object.keys(cols).length) {
    const { error } = await sb.from("usuarios").update(cols).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { data: atualizado } = await sb.from("usuarios").select("*").eq("id", id).maybeSingle();
  return NextResponse.json({ persisted: true, user: atualizado ? teamDe(atualizado as UsuarioRow) : undefined });
}
