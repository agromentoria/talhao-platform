import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "../config/navigation";
import { Page } from "../components/layout/Page";
import { Button, ErrorBanner } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      // volta para onde a pessoa queria ir antes de pedir login
      navigate(location.state?.from || homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page title="Entrar" width="narrow">
      <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
        <img src="/logo-icon.svg" alt="" width={96} height={96} style={{ margin: "8px auto 12px" }} />
        <h1 className="page-title" style={{ color: "var(--success-text)" }}>Entrar no Meu Talhão</h1>
        <p className="page-subtitle" style={{ margin: "6px auto 24px" }}>Use sua conta de investidor, fazenda ou administração.</p>

        <ErrorBanner message={error} style={{ textAlign: "left" }} />

        <form onSubmit={handleSubmit} className="stack" style={{ textAlign: "left" }} noValidate={false}>
          <label className="sr-only" htmlFor="login-email">E-mail</label>
          <div className="input-group">
            <Mail size={18} aria-hidden />
            <input id="login-email" className="input" type="email" required autoComplete="username" inputMode="email"
              autoCapitalize="none" spellCheck={false} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <label className="sr-only" htmlFor="login-password">Senha</label>
          <div className="input-group">
            <Lock size={18} aria-hidden />
            <input id="login-password" className="input" type={showPassword ? "text" : "password"} required autoComplete="current-password"
              placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="icon-btn" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>
          <Button type="submit" size="lg" block loading={loading} style={{ marginTop: 8 }}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="text-sm text-2" style={{ marginTop: 24 }}>
          Ainda não tem conta? <Link to="/cadastro" state={location.state} style={{ fontWeight: 700 }}>Criar conta</Link>
        </p>
      </div>
    </Page>
  );
}
