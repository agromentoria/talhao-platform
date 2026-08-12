import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Camera } from "lucide-react";
import { COLORS, BACKGROUNDS } from "../theme";
import { useAuth } from "../context/AuthContext";
import { ErrorBanner } from "../components/Shared";
import CityStateSelect from "../components/CityStateSelect";

const MAX_AVATAR_BYTES = 1_200_000;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("investidor");
  const [form, setForm] = useState({ name: "", email: "", password: "", farmName: "", farmLocation: "" });
  const [avatar, setAvatar] = useState(null);
  const [avatarError, setAvatarError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (!file.type.startsWith("image/")) {
      setAvatarError("Escolha um arquivo de imagem (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Imagem muito grande. Escolha um arquivo de até 1,2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result);
    reader.onerror = () => setAvatarError("Não foi possível ler essa imagem. Tente outra.");
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await register({ ...form, role, avatar });
      if (user.role === "fazenda") navigate("/fazenda");
      else navigate("/carteira");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      maxWidth: 460, margin: "24px auto", padding: "36px 28px 32px", borderRadius: 26,
      background: `${COLORS.headerGreen} url(${BACKGROUNDS.green}) center / cover no-repeat`,
      boxShadow: "0 8px 24px rgba(52,37,25,0.2)", color: "#fff", textAlign: "center",
    }}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: 96, height: 96, borderRadius: 20, background: "#fff", margin: "0 auto 10px", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: 0,
        }}
        title="Adicionar foto de perfil"
      >
        {avatar ? (
          <img src={avatar} alt="Sua foto de perfil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <img src="/logo-icon.svg" alt="" style={{ width: 76, height: 76 }} />
        )}
        <div style={{
          position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: "50%",
          background: COLORS.orange, display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid #fff",
        }}>
          <Camera size={14} color="#fff" />
        </div>
      </button>
      <p style={{ fontSize: 11.5, opacity: 0.85, margin: "0 0 18px" }}>
        {avatar ? "Toque para trocar a foto" : "Toque para adicionar sua foto (opcional)"}
      </p>
      {avatarError && <p style={{ fontSize: 12, color: "#FFD7D7", margin: "-12px 0 16px" }}>{avatarError}</p>}

      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 700, margin: "0 0 4px" }}>Criar uma conta</h1>
      <p style={{ fontSize: 13.5, opacity: 0.9, marginBottom: 22 }}>Escolha o tipo de conta que combina com você.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "investidor", label: "Sou investidor" },
          { id: "fazenda", label: "Sou uma fazenda" },
        ].map((opt) => (
          <button key={opt.id} type="button" onClick={() => setRole(opt.id)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13.5, cursor: "pointer", fontWeight: 600,
            border: role === opt.id ? "none" : "1px solid rgba(255,255,255,0.5)",
            background: role === opt.id ? COLORS.orange : "transparent",
            color: "#fff",
          }}>{opt.label}</button>
        ))}
      </div>

      <ErrorBanner message={error} />

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
        <Field label="Nome completo" value={form.name} onChange={(v) => update("name", v)} required />
        <Field label="E-mail" type="email" value={form.email} onChange={(v) => update("email", v)} required />
        <Field label="Senha (mínimo 8 caracteres)" type="password" value={form.password} onChange={(v) => update("password", v)} required minLength={8} />

        {role === "fazenda" && (
          <>
            <Field label="Nome da fazenda" value={form.farmName} onChange={(v) => update("farmName", v)} required />
            <CityStateSelect
              value={form.farmLocation}
              onChange={(v) => update("farmLocation", v)}
              required
              labelStyle={{ fontSize: 12, color: "#fff", opacity: 0.9 }}
              selectStyle={{ width: "100%", marginTop: 5, padding: "12px 14px", borderRadius: 12, border: "none", fontSize: 14, color: COLORS.soil }}
            />
            <p style={{ fontSize: 12, opacity: 0.85, margin: 0, lineHeight: 1.5 }}>
              Sua fazenda entra em análise da administração do Talhão antes de poder publicar talhões para investimento.
            </p>
          </>
        )}

        <button type="submit" disabled={loading} style={{
          marginTop: 8, padding: "15px 0", borderRadius: 14, border: "none", background: COLORS.orange,
          color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Baloo 2', cursive", cursor: "pointer",
          opacity: loading ? 0.7 : 1, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {loading ? "Criando conta..." : "Começar"}
        </button>
      </form>

      <p style={{ fontSize: 13, marginTop: 18 }}>
        Já tem conta? <Link to="/login" style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }}>Entrar</Link>
      </p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, minLength }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: "#fff", opacity: 0.9 }}>{label}</label>
      <input type={type} required={required} minLength={minLength} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", marginTop: 5, padding: "12px 14px", borderRadius: 12, border: "none", fontSize: 14, color: COLORS.soil }} />
    </div>
  );
}
