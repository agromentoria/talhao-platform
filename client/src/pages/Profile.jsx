import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Camera, UserRound, Mail, Phone, Lock, Tractor, CreditCard, QrCode, Landmark, MessageCircle, Bell, Coins, ChevronRight, LogOut, FileText, Shield, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../config/theme";
import { api } from "../lib/api";
import { readImageFile } from "../lib/files";
import {
  maskCPF, isValidCPF, maskCNPJ, isValidCNPJ, maskPhone, isValidPhone,
  isValidEmail, isValidRandomKey, onlyDigits, BRAZILIAN_BANKS, maskAgencia,
  isValidAgencia, maskConta, isValidConta, maskCEP, buscarEnderecoPorCEP,
} from "../lib/validators";
import { Page, PageHeader } from "../components/layout/Page";
import { Avatar } from "../components/layout/AppShell";
import { Button, ErrorBanner, Loading, Segmented, TextField, SelectField, Tabs, Dialog, useDialog, useToast } from "../components/ui";

const TABS = [
  { id: "conta", label: "Conta" },
  { id: "documentos", label: "Documentos" },
  { id: "recebimento", label: "Recebimento" },
  { id: "mais", label: "Mais" },
];

export default function Profile() {
  const { user, updateSession, logout } = useAuth();
  const navigate = useNavigate();
  const dialog = useDialog();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("aba")) ? params.get("aba") : "conta";
  const setTab = (id) => setParams(id === "conta" ? {} : { aba: id }, { replace: true });

  const [avatarError, setAvatarError] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  if (!user) return null;

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError("");
    setSavingAvatar(true);
    try {
      const dataUrl = await readImageFile(file, { maxSide: 512 });
      updateSession(await api.updateAvatar(dataUrl));
      toast("Foto atualizada");
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleLogout() {
    const ok = await dialog.confirm({ title: "Sair da conta?", message: "Você precisará entrar de novo para ver seus dados.", confirmLabel: "Sair" });
    if (!ok) return;
    logout();
    navigate("/", { replace: true });
  }

  return (
    <Page title="Perfil" width="narrow">
      <PageHeader title="Seu perfil" subtitle={`${ROLE_LABEL[user.role]} · dados de contato, documentos e recebimento.`} />

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} hidden />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={savingAvatar} aria-label="Trocar foto de perfil"
          style={{ position: "relative", border: "none", background: "none", padding: 0, borderRadius: "50%" }}>
          <Avatar user={user} size={76} />
          <span style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
            {savingAvatar ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Camera size={13} color="#fff" aria-hidden />}
          </span>
        </button>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-xl)", lineHeight: 1.2 }} className="truncate">{user.name}</p>
          <p className="text-sm text-2 truncate">{user.email}</p>
        </div>
      </div>
      <ErrorBanner message={avatarError} />

      <Tabs label="Seções do perfil" tabs={TABS} value={tab} onChange={setTab} />

      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "conta" && <AccountTab />}
        {tab === "documentos" && <LegalInfoForm />}
        {tab === "recebimento" && <PayoutForm />}
        {tab === "mais" && <MoreTab onLogout={handleLogout} />}
      </div>
    </Page>
  );
}

// ---------- Conta ----------
function AccountTab() {
  const { user, updateSession } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone ? maskPhone(user.phone) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      updateSession(await api.updateProfile({ name, email: email.trim(), phone }));
      toast("Dados atualizados");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwError("");
    setSavingPw(true);
    try {
      await api.updatePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword("");
      toast("Senha alterada");
    } catch (err) {
      setPwError(err.message);
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="stack-lg">
      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 14 }}>Dados de contato</h2>
        <ErrorBanner message={error} />
        <form onSubmit={saveProfile} className="stack">
          <TextField icon={UserRound} label="Nome completo" value={name} onChange={setName} required autoComplete="name" />
          <TextField icon={Mail} label="E-mail" type="email" value={email} onChange={setEmail} required autoComplete="email" inputMode="email" autoCapitalize="none" />
          <TextField icon={Phone} label="Telefone ou WhatsApp" value={phone} onChange={(v) => setPhone(maskPhone(v))} placeholder="(00) 00000-0000" inputMode="tel" autoComplete="tel-national" />
          <Button type="submit" loading={saving} style={{ alignSelf: "flex-start" }}>Salvar dados</Button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 14 }}>Alterar senha</h2>
        <ErrorBanner message={pwError} />
        <form onSubmit={savePassword} className="stack">
          {/* campo oculto ajuda o gerenciador de senhas (iCloud Keychain / Google) a associar a conta */}
          <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
          <TextField icon={Lock} label="Senha atual" type="password" value={currentPassword} onChange={setCurrentPassword} required autoComplete="current-password" />
          <TextField icon={Lock} label="Nova senha" hint="Mínimo de 8 caracteres." type="password" value={newPassword} onChange={setNewPassword} required minLength={8} autoComplete="new-password" />
          <Button type="submit" variant="secondary" loading={savingPw} style={{ alignSelf: "flex-start" }}>Alterar senha</Button>
        </form>
      </section>
    </div>
  );
}

// ---------- Mais: atalhos, documentos legais, sair e excluir conta ----------
function MoreTab({ onLogout }) {
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const links = [
    user.role === "fazenda" && { to: "/fazenda", icon: Tractor, label: "Painel da fazenda" },
    user.role === "fazenda" && { to: "/fazenda/carteira", icon: Coins, label: "Carteira (vendas e recebimentos)" },
    user.role === "investidor" && { to: "/pagamentos", icon: CreditCard, label: "Formas de pagamento" },
    { to: "/conversas", icon: MessageCircle, label: "Conversas" },
    { to: "/avisos", icon: Bell, label: "Avisos" },
    { to: "/termos", icon: FileText, label: "Termos de uso" },
    { to: "/privacidade", icon: Shield, label: "Política de privacidade" },
  ].filter(Boolean);

  return (
    <div className="stack-lg">
      <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="list-item" style={{ minHeight: 56 }}>
              <l.icon size={20} aria-hidden style={{ color: "var(--text-2)" }} />
              <span className="list-item-body list-item-title">{l.label}</span>
              <ChevronRight size={18} aria-hidden style={{ color: "var(--text-3)" }} />
            </Link>
          </li>
        ))}
      </ul>

      <Button variant="secondary" icon={LogOut} block onClick={onLogout}>Sair da conta</Button>

      <section className="card" style={{ borderColor: "#e9b9b9" }}>
        <h2 className="card-title">Excluir conta</h2>
        <p className="card-desc" style={{ marginBottom: 14 }}>
          Remove seus dados pessoais, fotos, cartões e dados de recebimento. Registros financeiros já concluídos são mantidos de forma anonimizada pelo prazo exigido em lei.
        </p>
        <Button variant="danger-ghost" icon={Trash2} onClick={() => setDeleteOpen(true)}>Excluir minha conta</Button>
      </section>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}

function DeleteAccountDialog({ open, onClose }) {
  const { deleteAccount, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await deleteAccount(password);
      toast("Sua conta foi excluída");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Excluir conta definitivamente?">
      <form onSubmit={handleDelete} className="stack">
        <p>Esta ação não pode ser desfeita. {user.role === "investidor" ? "Se você tiver investimentos em andamento, a exclusão só fica disponível depois que as colheitas forem pagas." : user.role === "fazenda" ? "Fazendas com talhões em captação ou em andamento precisam concluir ou encerrar esses talhões antes." : ""}</p>
        <ErrorBanner message={error} />
        <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
        <TextField label="Digite sua senha para confirmar" type="password" value={password} onChange={setPassword} required autoComplete="current-password" />
        <div className="dialog-actions" style={{ marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="danger" loading={loading} disabled={!password}>Excluir conta</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------- Recebimento ----------
function PayoutForm() {
  const { user } = useAuth();
  const toast = useToast();
  const [method, setMethod] = useState("pix");
  const [pixTipo, setPixTipo] = useState("cpf");
  const [pixChave, setPixChave] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [titular, setTitular] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPayoutAccount()
      .then(({ account: acc }) => {
        if (!acc) return;
        setTitular(acc.titular || "");
        if (acc.pix_chave) {
          setMethod("pix");
          const tipo = acc.pix_tipo || "cpf";
          setPixTipo(tipo);
          setPixChave(tipo === "cpf" ? maskCPF(acc.pix_chave) : tipo === "cnpj" ? maskCNPJ(acc.pix_chave) : tipo === "telefone" ? maskPhone(acc.pix_chave) : acc.pix_chave);
        } else if (acc.banco) {
          setMethod("banco");
          setBanco(acc.banco);
          setAgencia(maskAgencia(acc.agencia || ""));
          setConta(maskConta(acc.conta || ""));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function validate() {
    if (method === "pix") {
      if (!pixChave) return "Informe a chave Pix.";
      if (pixTipo === "cpf" && !isValidCPF(pixChave)) return "CPF inválido. Confira os números.";
      if (pixTipo === "cnpj" && !isValidCNPJ(pixChave)) return "CNPJ inválido. Confira os números.";
      if (pixTipo === "telefone" && !isValidPhone(pixChave)) return "Telefone inválido. Informe DDD e número.";
      if (pixTipo === "email" && !isValidEmail(pixChave)) return "E-mail inválido.";
      if (pixTipo === "aleatoria" && !isValidRandomKey(pixChave)) return "Chave aleatória inválida: use o código de 32 caracteres gerado pelo banco.";
      return null;
    }
    if (!banco) return "Escolha o banco.";
    if (!isValidAgencia(agencia)) return "Agência inválida: informe de 3 a 5 dígitos.";
    if (!isValidConta(conta)) return "Conta inválida: informe de 4 a 13 dígitos, com o dígito verificador.";
    return null;
  }

  function onChaveChange(v) {
    if (pixTipo === "cpf") setPixChave(maskCPF(v));
    else if (pixTipo === "cnpj") setPixChave(maskCNPJ(v));
    else if (pixTipo === "telefone") setPixChave(maskPhone(v));
    else setPixChave(v.trim());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      const numeric = ["cpf", "cnpj", "telefone"].includes(pixTipo);
      await api.savePayoutAccount(method === "pix"
        ? { pix_tipo: pixTipo, pix_chave: numeric ? onlyDigits(pixChave) : pixChave, titular }
        : { banco, agencia: onlyDigits(agencia), conta: onlyDigits(conta), titular });
      toast("Dados de recebimento salvos");
    } catch (er) {
      setError(er.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  const placeholder = { cpf: "000.000.000-00", cnpj: "00.000.000/0000-00", telefone: "(00) 00000-0000", email: "nome@exemplo.com", aleatoria: "00000000-0000-0000-0000-000000000000" }[pixTipo];

  return (
    <section className="card">
      <h2 className="card-title">Dados para recebimento</h2>
      <p className="card-desc" style={{ marginBottom: 16 }}>
        {{ investidor: "Conta onde você recebe o resultado das colheitas.", fazenda: "Conta onde a fazenda recebe a comissão das colheitas.", admin: "Conta onde a plataforma recebe a comissão." }[user.role]}
      </p>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="stack">
        <Segmented label="Forma de recebimento" value={method} onChange={setMethod} options={[{ id: "pix", label: "Pix", icon: QrCode }, { id: "banco", label: "Conta bancária", icon: Landmark }]} />
        {method === "pix" ? (
          <>
            <SelectField label="Tipo de chave" value={pixTipo} onChange={(v) => { setPixTipo(v); setPixChave(""); }}
              options={[{ value: "cpf", label: "CPF" }, { value: "cnpj", label: "CNPJ" }, { value: "email", label: "E-mail" }, { value: "telefone", label: "Telefone" }, { value: "aleatoria", label: "Chave aleatória" }]} />
            <TextField label="Chave Pix" value={pixChave} onChange={onChaveChange} required placeholder={placeholder}
              type={pixTipo === "email" ? "email" : "text"} inputMode={["cpf", "cnpj"].includes(pixTipo) ? "numeric" : pixTipo === "telefone" ? "tel" : pixTipo === "email" ? "email" : "text"} autoCapitalize="none" />
          </>
        ) : (
          <>
            <SelectField label="Banco" value={banco} onChange={setBanco} required>
              <option value="">Escolha o banco</option>
              {BRAZILIAN_BANKS.map((b) => <option key={b.code} value={`${b.code} - ${b.name}`}>{b.code} - {b.name}</option>)}
            </SelectField>
            <div className="row">
              <TextField label="Agência" value={agencia} onChange={(v) => setAgencia(maskAgencia(v))} placeholder="0000" required inputMode="numeric" />
              <TextField label="Conta com dígito" value={conta} onChange={(v) => setConta(maskConta(v))} placeholder="00000-0" required inputMode="numeric" />
            </div>
          </>
        )}
        <TextField label="Nome do titular" value={titular} onChange={setTitular} required autoComplete="name" />
        <Button type="submit" loading={saving} style={{ alignSelf: "flex-start" }}>Salvar dados de recebimento</Button>
      </form>
    </section>
  );
}

// ---------- Documentos ----------
function LegalInfoForm() {
  const toast = useToast();
  const [f, setF] = useState({
    tipoPessoa: "fisica", cpf: "", cnpj: "", rg: "", rgOrgao: "", nacionalidade: "Brasileira", estadoCivil: "", profissao: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getLegalInfo().then(({ legalInfo: i }) => {
      if (!i) return;
      setF({
        tipoPessoa: i.tipo_pessoa || "fisica", cpf: i.cpf ? maskCPF(i.cpf) : "", cnpj: i.cnpj ? maskCNPJ(i.cnpj) : "",
        rg: i.rg || "", rgOrgao: i.rg_orgao_emissor || "", nacionalidade: i.nacionalidade || "Brasileira",
        estadoCivil: i.estado_civil || "", profissao: i.profissao || "", cep: i.endereco_cep ? maskCEP(i.endereco_cep) : "",
        logradouro: i.endereco_logradouro || "", numero: i.endereco_numero || "", complemento: i.endereco_complemento || "",
        bairro: i.endereco_bairro || "", cidade: i.endereco_cidade || "", uf: i.endereco_uf || "",
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function onCep(v) {
    const masked = maskCEP(v);
    set("cep")(masked);
    if (onlyDigits(masked).length !== 8) return;
    setBuscandoCep(true);
    try {
      const end = await buscarEnderecoPorCEP(masked);
      if (end) setF((s) => ({ ...s, logradouro: end.logradouro, bairro: end.bairro, cidade: end.cidade, uf: end.uf }));
    } catch { /* preenchimento manual continua possível */ } finally { setBuscandoCep(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (f.tipoPessoa === "fisica" && !isValidCPF(f.cpf)) { setError("CPF inválido. Confira os números."); return; }
    if (f.tipoPessoa === "juridica" && !isValidCNPJ(f.cnpj)) { setError("CNPJ inválido. Confira os números."); return; }
    setSaving(true);
    try {
      await api.updateLegalInfo({
        tipo_pessoa: f.tipoPessoa,
        cpf: f.tipoPessoa === "fisica" ? onlyDigits(f.cpf) : null,
        cnpj: f.tipoPessoa === "juridica" ? onlyDigits(f.cnpj) : null,
        rg: f.rg, rg_orgao_emissor: f.rgOrgao, nacionalidade: f.nacionalidade, estado_civil: f.estadoCivil, profissao: f.profissao,
        endereco_cep: onlyDigits(f.cep), endereco_logradouro: f.logradouro, endereco_numero: f.numero,
        endereco_complemento: f.complemento, endereco_bairro: f.bairro, endereco_cidade: f.cidade, endereco_uf: f.uf,
      });
      toast("Documentos salvos");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <section className="card">
      <h2 className="card-title">Documentos e endereço</h2>
      <p className="card-desc" style={{ marginBottom: 16 }}>Ficam privados, visíveis só para você e para a administração, e são usados nos contratos.</p>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="span-all">
          <Segmented label="Tipo de pessoa" value={f.tipoPessoa} onChange={set("tipoPessoa")} options={[{ id: "fisica", label: "Pessoa física" }, { id: "juridica", label: "Pessoa jurídica" }]} />
        </div>
        {f.tipoPessoa === "fisica"
          ? <TextField label="CPF" value={f.cpf} onChange={(v) => set("cpf")(maskCPF(v))} placeholder="000.000.000-00" required inputMode="numeric" />
          : <TextField label="CNPJ" value={f.cnpj} onChange={(v) => set("cnpj")(maskCNPJ(v))} placeholder="00.000.000/0000-00" required inputMode="numeric" />}
        <TextField label="RG ou documento equivalente" value={f.rg} onChange={set("rg")} required />
        <TextField label="Órgão emissor" value={f.rgOrgao} onChange={set("rgOrgao")} placeholder="Ex.: SSP-GO" />
        <TextField label="Nacionalidade" value={f.nacionalidade} onChange={set("nacionalidade")} />
        <SelectField label="Estado civil" value={f.estadoCivil} onChange={set("estadoCivil")}
          options={[{ value: "", label: "Selecione" }, { value: "solteiro", label: "Solteiro(a)" }, { value: "casado", label: "Casado(a)" }, { value: "uniao_estavel", label: "União estável" }, { value: "divorciado", label: "Divorciado(a)" }, { value: "viuvo", label: "Viúvo(a)" }]} />
        <TextField label="Profissão" value={f.profissao} onChange={set("profissao")} autoComplete="organization-title" />

        <h3 className="span-all card-title" style={{ marginTop: 8 }}>Endereço</h3>
        <TextField label="CEP" hint={buscandoCep ? "Buscando endereço…" : undefined} value={f.cep} onChange={onCep} placeholder="00000-000" required inputMode="numeric" autoComplete="postal-code" />
        <TextField label="Logradouro" value={f.logradouro} onChange={set("logradouro")} required autoComplete="address-line1" />
        <TextField label="Número" value={f.numero} onChange={set("numero")} required inputMode="numeric" />
        <TextField label="Complemento" value={f.complemento} onChange={set("complemento")} placeholder="Apto, bloco…" autoComplete="address-line2" />
        <TextField label="Bairro" value={f.bairro} onChange={set("bairro")} required />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10 }}>
          <TextField label="Cidade" value={f.cidade} onChange={set("cidade")} required autoComplete="address-level2" />
          <TextField label="UF" value={f.uf} onChange={(v) => set("uf")(v.toUpperCase().slice(0, 2))} required autoComplete="address-level1" />
        </div>
        <div className="span-all"><Button type="submit" loading={saving}>Salvar documentos</Button></div>
      </form>
    </section>
  );
}
