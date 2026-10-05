import { Component } from "react";

// Se uma página quebrar por um erro de JavaScript, só ela mostra o aviso —
// a navegação continua funcionando. resetKey (a rota atual) limpa o erro
// quando a pessoa navega para outra tela, sem recarregar o app.
export default class ErrorBoundary extends Component {
  state = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error) {
    // depois de publicar uma versão nova, telas abertas podem pedir arquivos
    // que já não existem — nesse caso basta recarregar
    const isChunkError = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(String(error?.message));
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error, info) {
    console.error("[erro de renderização]", error, info);
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) this.setState({ hasError: false, isChunkError: false });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const { isChunkError } = this.state;
    return (
      <div className="page page--narrow">
        <div className="empty">
          <img src="/icons/icon_talhao_meu_talhao.svg" alt="" />
          <p className="empty-title">Esta tela não carregou</p>
          <p className="empty-text">
            {isChunkError ? "Há uma versão nova do app." : "O restante do app continua funcionando."} Tente abrir de novo ou volte para o início.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="btn btn--secondary" onClick={() => window.location.reload()}>Tentar de novo</button>
            <a className="btn btn--primary" href="/">Ir para o início</a>
          </div>
        </div>
      </div>
    );
  }
}
