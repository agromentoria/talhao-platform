import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Camera, TrendingUp, Tractor, Warehouse, Package, Ship } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "../config/navigation";
import { api } from "../lib/api";
import { readImageFile } from "../lib/files";
import { maskCNPJ, isValidCNPJ } from "../lib/validators";
import { Page } from "../components/layout/Page";
import { Button, Banner, ErrorBanner, TextField, Segmented } from "../components/ui";
import { CityStateSelect } from "../components/domain";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState("investidor");
  // código de indicação vindo do link de convite (/cadastro?indicacao=MT12ABC)
  const indicacao = new URLSearchParams(window.location.search).get("indicacao") || "";
  const [cadastroAberto, setCadastroAberto] = useState(false);
  useEffect(() => { api.configMarketplace().then((c) => setCadastroAberto(!!c.cadastro_aberto)).catch(() => {}); }, []);
  const [form, setForm] = useState({ name: "", email: "", password: "", farmName: "", farmLocation: "", warehouseName: "", warehouseLocation: "", warehouseCnpj: "",
    empresaNome: "", empresaCnpj: "", empresaLocal: "", empresaRegioes: "", empresaCategorias: [], empresaCulturas: [] });
  const [avatar, setAvatar] = useState(null);
  const [avatarError, setAvatarError] = useState("");
  const [aceite, setAceite] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError("");
    try {
      setAvatar(await readImageFile(file, { maxSide: 512 }));
    } catch (err) {
      setAvatarError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (role === "fazenda" && !form.farmLocation) {
      setError("Escolha o estado e a cidade da fazenda.");
      return;
    }
    if (role === "armazem") {
      if (!form.warehouseLocation) { setError("Escolha o estado e a cidade do armazém."); return; }
      if (!isValidCNPJ(form.warehouseCnpj)) { setError("CNPJ do armazém inválido. Confira os números."); return; }
    }
    if (role === "fornecedor" || role === "trading") {
      if (!form.empresaLocal) { setError("Escolha o estado e a cidade da empresa."); return; }
      if (!isValidCNPJ(form.empresaCnpj)) { setError("CNPJ da empresa inválido. Confira os números."); return; }
    }
    setLoading(true);
    try {
      const user = await register({ ...form, email: form.email.trim(), role, avatar, indicacao: role === "investidor" ? indicacao || undefined : undefined });
      navigate(location.state?.from || homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page title="Criar conta" width="narrow">
      <div className="on-dark" style={{
        maxWidth: 480, margin: "0 auto", padding: "28px clamp(18px, 5vw, 32px) 28px", borderRadius: "var(--r-xl)",
        background: "var(--brand-header) url(/bg-farm-green.svg) center / cover no-repeat",
        boxShadow: "var(--shadow-2)", color: "#fff",
      }}>
        <div style={{ textAlign: "center" }}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} hidden />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={avatar ? "Trocar foto de perfil" : "Adicionar foto de perfil (opcional)"}
            style={{ width: 92, height: 92, borderRadius: 22, background: "#fff", margin: "0 auto 8px", border: "none", position: "relative", overflow: "hidden", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src="/logo-icon.svg" alt="" style={{ width: 72, height: 72 }} />}
            <span style={{ position: "absolute", bottom: 4, right: 4, width: 30, height: 30, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
              <Camera size={14} color="#fff" aria-hidden />
            </span>
          </button>
          <p className="text-xs" style={{ opacity: 0.9 }}>{avatar ? "Toque para trocar a foto" : "Foto de perfil (opcional)"}</p>
          {avatarError && <p className="text-xs" style={{ color: "#FFD7D7", marginTop: 6 }}>{avatarError}</p>}

          <h1 style={{ color: "#fff", fontSize: "var(--fs-2xl)", margin: "16px 0 4px" }}>Criar sua conta</h1>
          <p className="text-sm" style={{ opacity: 0.92, marginBottom: 18 }}>Como você vai usar o Meu Talhão?</p>
        </div>

        <Segmented
          label="Tipo de conta"
          value={role}
          onChange={setRole}
          options={[
            { id: "investidor", label: "Investidor", icon: TrendingUp },
            { id: "fazenda", label: "Fazenda", icon: Tractor },
            { id: "armazem", label: "Armazém", icon: Warehouse },
            ...(cadastroAberto ? [{ id: "fornecedor", label: "Fornecedor", icon: Package }, { id: "trading", label: "Trading", icon: Ship }] : []),
          ]}
        />

        <div style={{ height: 18 }} />
        <ErrorBanner message={error} />

        {indicacao && role === "investidor" && (
          <Banner tone="success" title="Você foi convidado">Cadastre-se com o código {indicacao} e ganhe crédito na primeira compra de sacas.</Banner>
        )}
        <form onSubmit={handleSubmit} className="stack">
          <p className="text-sm" style={{ opacity: 0.95, lineHeight: 1.5, marginTop: -6 }}>
            {{
              investidor: "Compre parte da produção de talhões e acompanhe a safra até a colheita.",
              fazenda: "Publique talhões e receba investimento para a safra.",
              armazem: "Seja o garantidor: valide plantio, colheita e armazenagem dos talhões que as fazendas indicarem.",
              fornecedor: "Venda sementes, corretivos, adubos, defensivos, diesel e serviços para as fazendas do app. O fundo paga.",
              trading: "Acompanhe a produção em andamento e compre o grão direto dos talhões, com armazém garantidor.",
            }[role]}{" "}<Link to="/como-funciona" style={{ color: "#fff", fontWeight: 700 }}>Como funciona</Link>
          </p>
          <TextField label={role === "armazem" ? "Nome do responsável" : "Nome completo"} value={form.name} onChange={update("name")} required autoComplete="name" autoCapitalize="words" />
          <TextField label="E-mail" type="email" value={form.email} onChange={update("email")} required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} />
          <TextField label="Senha" hint="Mínimo de 8 caracteres." type="password" value={form.password} onChange={update("password")} required minLength={8} autoComplete="new-password" />

          {role === "fazenda" && (
            <>
              <TextField label="Nome da fazenda" value={form.farmName} onChange={update("farmName")} required autoComplete="organization" />
              <CityStateSelect value={form.farmLocation} onChange={update("farmLocation")} required />
              <p className="text-xs" style={{ opacity: 0.92, lineHeight: 1.5 }}>
                A administração analisa cada fazenda antes de liberar a publicação de talhões.
              </p>
            </>
          )}

          {role === "armazem" && (
            <>
              <TextField label="Nome do armazém" value={form.warehouseName} onChange={update("warehouseName")} required autoComplete="organization" />
              <TextField label="CNPJ do armazém" value={form.warehouseCnpj} onChange={(v) => update("warehouseCnpj")(maskCNPJ(v))} placeholder="00.000.000/0000-00" required inputMode="numeric" />
              <CityStateSelect value={form.warehouseLocation} onChange={update("warehouseLocation")} required />
              <p className="text-xs" style={{ opacity: 0.92, lineHeight: 1.5 }}>
                A administração confere o CNPJ e credencia o armazém antes de ele poder assumir custódias.
              </p>
            </>
          )}

          {(role === "fornecedor" || role === "trading") && (
            <>
              <TextField label="Razão social da empresa" value={form.empresaNome} onChange={update("empresaNome")} required autoComplete="organization" />
              <TextField label="CNPJ" value={form.empresaCnpj} onChange={(v) => update("empresaCnpj")(maskCNPJ(v))} placeholder="00.000.000/0000-00" required inputMode="numeric" />
              <CityStateSelect value={form.empresaLocal} onChange={update("empresaLocal")} required />
              <TextField label={role === "fornecedor" ? "Estados onde você entrega (siglas)" : "Estados onde você compra (siglas)"} value={form.empresaRegioes}
                onChange={(v) => update("empresaRegioes")(v.toUpperCase())} placeholder="GO, MT, MS" hint="Separe por vírgula. Dá para mudar depois." />
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="text-sm" style={{ fontWeight: 600, marginBottom: 6 }}>{role === "fornecedor" ? "O que você vende" : "Culturas que você compra"}</legend>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {(role === "fornecedor"
                    ? [["corretivo", "Corretivos"], ["fertilizante", "Adubos e fertilizantes"], ["nutritivo", "Nutritivos"], ["defensivo", "Defensivos"], ["semente", "Sementes"], ["combustivel", "Diesel"], ["servico", "Serviços"]]
                    : [["Soja", "Soja"], ["Milho", "Milho"], ["Feijão", "Feijão"], ["Algodão", "Algodão"], ["Trigo", "Trigo"], ["Café", "Café"]]).map(([id, nome]) => {
                    const campo = role === "fornecedor" ? "empresaCategorias" : "empresaCulturas";
                    const marcado = form[campo].includes(id);
                    return (
                      <label key={id} className={`chip ${marcado ? "chip--on" : ""}`} style={{ cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.6)", background: marcado ? "rgba(255,255,255,.25)" : "transparent", fontSize: "var(--fs-sm)" }}>
                        <input type="checkbox" checked={marcado} onChange={() => setForm((f) => ({ ...f, [campo]: marcado ? f[campo].filter((x) => x !== id) : [...f[campo], id] }))} style={{ margin: 0 }} />
                        {nome}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <p className="text-xs" style={{ opacity: 0.92, lineHeight: 1.5 }}>
                A administração confere o CNPJ antes de {role === "fornecedor" ? "suas ofertas aparecerem para as fazendas" : "liberar a produção em andamento"}.
              </p>
            </>
          )}

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "var(--fs-sm)", lineHeight: 1.45, marginTop: 4 }}>
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} required style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              Li e aceito os <Link to="/termos" style={{ color: "#fff", fontWeight: 700 }}>Termos de uso</Link> e a{" "}
              <Link to="/privacidade" style={{ color: "#fff", fontWeight: 700 }}>Política de privacidade</Link>.
            </span>
          </label>

          <Button type="submit" size="lg" block loading={loading} disabled={!aceite} style={{ marginTop: 6 }}>
            {loading ? "Criando conta…" : "Criar conta"}
          </Button>
        </form>

        <p className="text-sm" style={{ marginTop: 18, textAlign: "center" }}>
          Já tem conta? <Link to="/login" state={location.state} style={{ color: "#fff", fontWeight: 700 }}>Entrar</Link>
        </p>
      </div>
    </Page>
  );
}
