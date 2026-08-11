import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock } from "lucide-react";
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
    <div style={{ maxWidth: 400, margin: "40px auto", padding: "0 24px", textAlign: "center" }}>
      <img src="/logo-icon.svg" alt="" style={{ width: 96, height: 96, margin: "0 auto 12px" }} />
      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 28, color: COLORS.leaf, marginBottom: 6, fontWeight: 700 }}>
        Entrar no <span style={{ color: COLORS.leaf }}>talhão</span>
      </h1>
      <p style={{ fontSize: 13.5, color: COLORS.soilLight, marginBottom: 26, lineHeight: 1.5 }}>
        Acesse sua conta de investidor, fazenda ou administração.
      </p>

      <ErrorBanner message={error} />

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 14, padding: "13px 16px", boxShadow: "0 2px 8px rgba(52,37,25,0.08)" }}>
          <User size={17} color={COLORS.clay} />
          <input type="email" required placeholder="Digite seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: COLORS.soil }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 14, padding: "13px 16px", boxShadow: "0 2px 8px rgba(52,37,25,0.08)" }}>
          <Lock size={17} color={COLORS.clay} />
          <input type="password" required placeholder="Digite sua senha" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: COLORS.soil }} />
        </div>
        <button type="submit" disabled={loading} style={{
          marginTop: 10, padding: "15px 0", borderRadius: 14, border: "none", background: COLORS.orange,
          color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Baloo 2', cursive", cursor: "pointer",
          opacity: loading ? 0.7 : 1, boxShadow: "0 4px 12px rgba(221,130,9,0.35)",
        }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: COLORS.soilLight, marginTop: 22 }}>
        Não tem uma conta? <Link to="/cadastro" style={{ color: COLORS.orange, fontWeight: 700 }}>Cadastre-se</Link>
      </p>
    </div>
  );
}
