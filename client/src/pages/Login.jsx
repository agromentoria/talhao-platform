import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { COLORS } from "../theme";
import { useAuth } from "../context/AuthContext";
import { ErrorBanner } from "../components/Shared";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "admin") navigate("/admin");
      else if (user.role === "fazenda") navigate("/fazenda");
      else navigate("/carteira");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "60px auto", padding: "0 20px" }}>
      <img src="/logo-icon.svg" alt="" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }} />
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: COLORS.soil, marginBottom: 4 }}>Entrar no Meu Talhão</h1>
      <p style={{ fontSize: 13.5, color: COLORS.soilLight, marginBottom: 24 }}>Acesse sua conta de investidor, fazenda ou administração.</p>

      <ErrorBanner message={error} />

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: COLORS.soilLight }}>E-mail</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", marginTop: 5, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: COLORS.soilLight }}>Senha</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginTop: 5, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 14 }} />
        </div>
        <button type="submit" disabled={loading} style={{
          marginTop: 8, padding: "11px 0", borderRadius: 9, border: "none", background: COLORS.leaf,
          color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: COLORS.soilLight, marginTop: 18, textAlign: "center" }}>
        Ainda não tem conta? <Link to="/cadastro" style={{ color: COLORS.leaf, fontWeight: 500 }}>Cadastre-se</Link>
      </p>
    </div>
  );
}
