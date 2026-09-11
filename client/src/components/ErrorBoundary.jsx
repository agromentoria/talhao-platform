import { Component } from "react";
import { COLORS } from "../theme";

// Error boundaries só funcionam como componente de classe no React —
// não existe equivalente com hooks ainda. Isso protege o app inteiro:
// se uma página específica quebrar por um erro de JavaScript, o resto
// do app (o menu, principalmente) continua funcionando, em vez de tudo
// sumir da tela.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[erro de renderização]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "60px 24px", textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
          <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, color: COLORS.soil, margin: "0 0 8px" }}>
            Ops, algo deu errado nesta página
          </p>
          <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: "0 0 20px", lineHeight: 1.5 }}>
            Não foi possível carregar esta parte do app. Isso não afeta o restante — você pode voltar para a página inicial.
          </p>
          <button onClick={this.handleReset} style={{
            padding: "10px 20px", borderRadius: 10, border: "none", background: COLORS.orange,
            color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
          }}>
            Voltar para o início
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
