import { Link } from "react-router-dom";
import { Page, PageHeader } from "../../components/layout/Page";
import { Banner } from "../../components/ui";
import { EMPRESA, LEGAL_ATUALIZADO } from "./empresa";

export const LEGAL_CONTACT = EMPRESA.emailPrivacidade;
export const LEGAL_UPDATED = LEGAL_ATUALIZADO;
const pendente = Object.values(EMPRESA).some((v) => String(v).startsWith("["));

// Estrutura comum das páginas legais. O texto é um MODELO e precisa de revisão
// jurídica antes da publicação.
export default function LegalPage({ title, children }) {
  return (
    <Page title={title} back="/" width="narrow">
      <PageHeader title={title} subtitle={`Atualizado em ${LEGAL_ATUALIZADO}`} back="/" backLabel="Voltar" />
      {(import.meta.env.DEV || pendente) && (
        <Banner tone="warning" style={{ marginBottom: 20 }}>Modelo inicial: preencha os dados da empresa em <code>src/pages/legal/empresa.js</code> e revise com o jurídico antes da publicação.</Banner>
      )}
      <article className="card legal" style={{ lineHeight: 1.65 }}>{children}</article>
      <p className="text-xs text-3" style={{ textAlign: "center", marginTop: 16 }}>
        <Link to="/privacidade">Privacidade</Link> · <Link to="/termos">Termos de uso</Link> · <Link to="/compliance">Compliance e riscos</Link> · Meu Talhão versão {__APP_VERSION__}
      </p>
    </Page>
  );
}
