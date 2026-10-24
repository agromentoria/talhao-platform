import { Link } from "react-router-dom";
import { Page, PageHeader } from "../../components/layout/Page";
import { Banner } from "../../components/ui";
import { EMPRESA_PADRAO, LEGAL_ATUALIZADO, useEmpresa, empresaPendente } from "./empresa";

export const LEGAL_CONTACT = EMPRESA_PADRAO.emailPrivacidade;
export const LEGAL_UPDATED = LEGAL_ATUALIZADO;

// Estrutura comum das páginas legais. O texto é um MODELO e precisa de revisão
// jurídica antes da publicação.
export default function LegalPage({ title, children }) {
  const pendente = empresaPendente(useEmpresa());
  return (
    <Page title={title} back="/" width="narrow">
      <PageHeader title={title} subtitle={`Atualizado em ${LEGAL_ATUALIZADO}`} back="/" backLabel="Voltar" />
      {pendente && (
        <Banner tone="warning" style={{ marginBottom: 20 }}>Modelo inicial: a administração precisa preencher os dados da empresa (Painel › Dados da empresa) e o texto deve ser revisado pelo jurídico antes da publicação.</Banner>
      )}
      <article className="card legal" style={{ lineHeight: 1.65 }}>{children}</article>
      <p className="text-xs text-3" style={{ textAlign: "center", marginTop: 16 }}>
        <Link to="/privacidade">Privacidade</Link> · <Link to="/termos">Termos de uso</Link> · <Link to="/compliance">Compliance e riscos</Link> · Meu Talhão versão {__APP_VERSION__}
      </p>
    </Page>
  );
}
