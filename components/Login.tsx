"use client";

import { useEffect, useState } from "react";
import { css } from "@/lib/css";
import { BRAND, BG_GRADIENT } from "@/lib/theme";
import { SENHA_PADRAO } from "@/lib/seed";
import { corDoCargo } from "@/lib/acesso";
import { Svg } from "./ui/Svg";
import Hoverable from "./ui/Hoverable";
import { Avatar } from "./ui/bits";
import { useApp } from "./store";

export default function Login() {
  const { login, team, demo, authErro } = useApp();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Erro vindo do store (ex.: login válido, mas e-mail fora da equipe).
  useEffect(() => { if (authErro) setErro(authErro); }, [authErro]);

  const entrar = async (e: string, s: string) => {
    if (loading) return;
    setLoading(true);
    setErro(null);
    const r = await login(e, s);
    if (!r.ok) setErro(r.error ?? "Email ou senha incorretos.");
    setLoading(false);
  };
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await entrar(email, senha); };

  const ipt = "width:100%; box-sizing:border-box; border:1px solid #E6E7EC; border-radius:12px; font-size:14px; padding:13px 16px; outline:none; background:#F8F9FB;";
  const demoUsers = demo ? team.filter((t) => t.ativo !== false && t.email) : [];

  return (
    <div style={css(`height:100vh; width:100%; display:flex; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; background:${BG_GRADIENT};`)}>
      {/* POPUP / card central */}
      <div style={css("width:100%; max-width:960px; height:600px; max-height:92vh; display:flex; background:#fff; color:#1B1B28; border-radius:22px; overflow:hidden; box-shadow:0 30px 80px rgba(20,24,40,.35);")}>
        {/* ESQUERDA: formulário */}
        <div style={css("flex:1.2; min-width:0; display:flex; align-items:center; justify-content:center; padding:32px; overflow-y:auto;")}>
          <form onSubmit={submit} style={css("width:100%; max-width:340px; display:flex; flex-direction:column; gap:16px;")}>
            <div style={css("display:flex; justify-content:center; margin-bottom:8px;")}>
              <img src="/logo.png" alt="Ju Budelon" style={css("height:150px; width:auto; object-fit:contain;")} />
            </div>

            <label style={css("display:flex; flex-direction:column; gap:6px;")}>
              <span style={css("font-size:13px; font-weight:700;")}>Email</span>
              <input type="email" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setErro(null); }} placeholder="nome@jubudelon.com.br" style={css(ipt)} />
            </label>

            <label style={css("display:flex; flex-direction:column; gap:6px;")}>
              <span style={css("font-size:13px; font-weight:700;")}>Senha</span>
              <input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(null); }} placeholder="••••••••" style={css(ipt)} />
            </label>

            {erro && (
              <div style={css("display:flex; align-items:center; gap:7px; background:#FDECEC; border:1px solid #F5C2C2; color:#CC3338; border-radius:10px; padding:9px 12px; font-size:13px; font-weight:600;")}>
                <Svg size={15} sw={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></Svg>
                {erro}
              </div>
            )}

            <Hoverable as="button" {...{ type: "submit", disabled: loading }} s={css(`width:100%; border:none; cursor:${loading ? "not-allowed" : "pointer"}; opacity:${loading ? 0.6 : 1}; background:${BRAND}; color:#fff; font-weight:700; font-size:15px; padding:14px; border-radius:999px; margin-top:6px;`)} hover={loading ? undefined : "filter:brightness(1.12)"}>{loading ? "Entrando…" : "Entrar"}</Hoverable>

            <p style={css("margin:6px 0 0; text-align:center; color:#9398A6; font-size:12px;")}>Ao continuar, você concorda com os Termos de serviço e a Política de privacidade.</p>
          </form>
        </div>

        {/* DIREITA: painel da marca — ou, no modo demo, os usuários de exemplo */}
        <div style={css("flex:1; min-width:0; display:none; position:relative; overflow:hidden; background:#7A4757; color:#fff; padding:32px 30px; flex-direction:column; gap:14px; overflow-y:auto;")} data-side="media">
          {demo ? (
            <>
              <div style={css("font-size:11px; font-weight:800; letter-spacing:0.8px; color:#F5ABBA; text-transform:uppercase;")}>Ambiente de demonstração</div>
              <div style={css("font-size:18px; font-weight:800; letter-spacing:-0.3px; line-height:1.3;")}>Entre com um dos usuários de exemplo</div>
              <div style={css("font-size:12.5px; color:#F3D9DF; line-height:1.55;")}>Os dados são fictícios e ficam salvos só neste navegador. A senha de todos é <b style={css("color:#fff;")}>{SENHA_PADRAO}</b>. Clique num nome para entrar direto.</div>
              <div style={css("display:flex; flex-direction:column; gap:8px; margin-top:6px;")}>
                {demoUsers.map((u) => (
                  <Hoverable key={u.id} as="button" {...{ type: "button", disabled: loading }} onClick={() => entrar(u.email!, SENHA_PADRAO)} s={css("display:flex; align-items:center; gap:11px; width:100%; text-align:left; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); border-radius:12px; padding:10px 12px; cursor:pointer; color:#fff;")} hover="background:rgba(255,255,255,.14)">
                    <Avatar ini={u.ini} cor={u.cor} src={u.foto} size={32} fontSize={12} />
                    <span style={css("flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.2;")}>
                      <span style={css("font-size:13.5px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{u.nome}</span>
                      <span style={css("font-size:11.5px; color:#F3D9DF; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{u.email}</span>
                    </span>
                    <span style={css(`flex:none; font-size:10.5px; font-weight:800; padding:3px 9px; border-radius:999px; background:${corDoCargo(u.cargo)}; color:#fff;`)}>{u.cargo}</span>
                  </Hoverable>
                ))}
              </div>
            </>
          ) : (
            <div style={css("flex:1; display:flex; flex-direction:column; justify-content:center; gap:14px;")}>
              <div style={css("font-size:11px; font-weight:800; letter-spacing:0.8px; color:#F5ABBA; text-transform:uppercase;")}>Sistema de gestão</div>
              <div style={css("font-size:26px; font-weight:800; letter-spacing:-0.5px; line-height:1.2;")}>Bem-vindo ao painel da Ju Budelon</div>
              <div style={css("font-size:13.5px; color:#F3D9DF; line-height:1.6;")}>Tarefas da operação, banco de talentos e vagas das unidades, num só lugar. Entre com o e-mail e a senha cadastrados pela administração.</div>
              <div style={css("margin-top:10px; display:flex; flex-direction:column; gap:8px;")}>
                {["Operacional → Tarefas", "Recrutamento → Banco de Talentos", "Recrutamento → Vagas e página pública"].map((t) => (
                  <div key={t} style={css("display:flex; align-items:center; gap:10px; font-size:13px; font-weight:700; color:#fff;")}>
                    <span style={css("width:8px; height:8px; border-radius:50%; background:#F5ABBA; flex:none;")} />{t}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mostra o painel só em telas largas; em telas estreitas fica só o formulário */}
      <style>{"@media (min-width: 900px){ [data-side=media]{ display:flex !important; } }"}</style>
    </div>
  );
}
