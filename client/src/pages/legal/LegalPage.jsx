import { Page, PageHeader } from "../../components/layout/Page";
import { Banner } from "../../components/ui";

export const LEGAL_CONTACT = "privacidade@meutalhao.com.br";
export const LEGAL_UPDATED = "5 de outubro de 2026";

// Estrutura comum das páginas legais. O texto é um MODELO inicial e precisa
// ser revisado pelo jurídico antes de publicar nas lojas.
export default function LegalPage({ title, children }) {
  return (
    <Page title={title} back="/" width="narrow">
      <PageHeader title={title} subtitle={`Atualizado em ${LEGAL_UPDATED}`} back="/" backLabel="Voltar" />
      {import.meta.env.DEV && (
        <Banner tone="warning" style={{ marginBottom: 20 }}>Modelo inicial: revise com o jurídico antes da publicação.</Banner>
      )}
      <article className="card legal" style={{ lineHeight: 1.65 }}>{children}</article>
    </Page>
  );
}
