import { Link } from "react-router-dom";
import LegalPage from "./LegalPage";
import { EMPRESA } from "./empresa";

export default function Compliance() {
  return (
    <LegalPage title="Compliance e avisos de risco">
      <h2>Aviso importante</h2>
      <p><strong>Investir em talhões envolve risco de perda do capital.</strong> Não há garantia do Fundo Garantidor de Créditos (FGC). Retornos mínimos dependem da capacidade de pagamento da fazenda e das garantias do talhão. As ofertas são feitas por meio de {EMPRESA.plataformaCvm}, nos termos da Resolução CVM nº 88, e não passaram por análise prévia da CVM.</p>

      <h2>Principais riscos</h2>
      <ul>
        <li><strong>Crédito:</strong> a fazenda pode não pagar o mínimo. Mitigação: análise do fundo, seguro agrícola obrigatório, CPR registrada, penhor da safra e grão em armazém credenciado.</li>
        <li><strong>Quebra de safra:</strong> clima, pragas ou doenças podem reduzir a produção. Mitigação: limite de 80% da produção à venda, seguro e regra de prorrogação.</li>
        <li><strong>Preço:</strong> a parte do lucro depende do preço público na janela de liquidação; o mínimo não depende do preço.</li>
        <li><strong>Liquidez:</strong> não é possível resgatar antes do pagamento da safra.</li>
        <li><strong>Regulatório e tributário:</strong> mudanças em regras da CVM ou na tributação dos títulos do agro podem afetar o produto.</li>
        <li><strong>Operacional:</strong> falhas de sistemas ou de parceiros (registradora, armazém, meios de pagamento).</li>
      </ul>

      <h2>Limites de investimento</h2>
      <p>Pela regulação de investimento participativo, o investidor não qualificado tem limite anual de aplicação nessas ofertas, conforme a norma vigente. O app pode pedir a declaração da sua condição de investidor.</p>

      <h2>Prevenção à lavagem de dinheiro e ao financiamento do terrorismo</h2>
      <p>Seguimos a Lei nº 9.613/1998 e as normas da CVM: verificamos a identidade de investidores, fazendas e armazéns, avaliamos a origem dos recursos quando necessário, monitoramos operações atípicas, comunicamos o COAF quando a lei exige e verificamos pessoas politicamente expostas e listas de sanções.</p>

      <h2>Conflitos de interesse</h2>
      <p>O app ganha 1% na entrada e 5% do lucro na saída de cada talhão, pagos pela fazenda. Para evitar o incentivo de aprovar talhões ruins, a aprovação é feita pelo fundo gestor com critérios publicados, o app avisa quando a margem do talhão não cobre o mínimo, e o pagamento usa preço público, não o declarado pela fazenda.</p>

      <h2>Transparência</h2>
      <p>Cada talhão mostra custo por saca, regras de divisão, índice de liquidação, seguro e o histórico de pagamentos da fazenda. Inadimplências e prorrogações são informadas a todos os investidores do talhão.</p>

      <h2>Canais</h2>
      <ul>
        <li>Compliance e denúncias (pode ser anônima): <a href={`mailto:${EMPRESA.emailCompliance}`}>{EMPRESA.emailCompliance}</a></li>
        <li>Ouvidoria: <a href={`mailto:${EMPRESA.emailOuvidoria}`}>{EMPRESA.emailOuvidoria}</a></li>
        <li>Privacidade e dados pessoais: <a href={`mailto:${EMPRESA.emailPrivacidade}`}>{EMPRESA.emailPrivacidade}</a> · <Link to="/privacidade">Política de Privacidade</Link></li>
      </ul>
    </LegalPage>
  );
}
