import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { COLORS } from "../theme";
import { useAuth } from "../context/AuthContext";
import { ErrorBanner } from "../components/Shared";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("investidor");
  const [form, setForm] = useState({ name: "", email: "", password: "", farmName: "", farmLocation: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await register({ ...form, role });
      if (user.role === "fazenda") navigate("/fazenda");
      else navigate("/carteira");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "50px auto", padding: "0 20px" }}>
      <img src="/logo-icon.svg" alt="" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }} />
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: COLORS.soil, marginBottom: 4 }}>Criar conta</h1>
      <p style={{ fontSize: 13.5, color: COLORS.soilLight, marginBottom: 20 }}>Escolha o tipo de conta que combina com você.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "investidor", label: "Sou investidor" },
          { id: "fazenda", label: "Sou uma fazenda" },
        ].map((opt) => (
          <button key={opt.id} type="button" onClick={() => setRole(opt.id)} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13.5, cursor: "pointer", fontWeight: 500,
            border: `1px solid ${role === opt.id ? COLORS.leaf : COLORS.line}`,
            background: role === opt.id ? COLORS.leaf : "#fff",
            color: role === opt.id ? "#fff" : COLORS.soilLight,
          }}>{opt.label}</button>
        ))}
      </div>

      <ErrorBanner message={error} />

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Nome completo" value={form.name} onChange={(v) => update("name", v)} required />
        <Field label="E-mail" type="email" value={form.email} onChange={(v) => update("email", v)} required />
        <Field label="Senha (mínimo 8 caracteres)" type="password" value={form.password} onChange={(v) => update("password", v)} required minLength={8} />

        {role === "fazenda" && (
          <>
            <Field label="Nome da fazenda" value={form.farmName} onChange={(v) => update("farmName", v)} required />
            <Field label="Localização (cidade, estado)" value={form.farmLocation} onChange={(v) => update("farmLocation", v)} required />
            <p style={{ fontSize: 12, color: COLORS.soilLight, margin: 0, lineHeight: 1.5 }}>
              Sua fazenda entra em análise da administração do Talhão antes de poder publicar talhões para investimento.
            </p>
          </>
        )}

        <button type="submit" disabled={loading} style={{
          marginTop: 8, padding: "11px 0", borderRadius: 9, border: "none", background: COLORS.leaf,
          color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: COLORS.soilLight, marginTop: 18, textAlign: "center" }}>
        Já tem conta? <Link to="/login" style={{ color: COLORS.leaf, fontWeight: 500 }}>Entrar</Link>
      </p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, minLength }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: COLORS.soilLight }}>{label}</label>
      <input type={type} required={required} minLength={minLength} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", marginTop: 5, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 14 }} />
    </div>
  );
}
