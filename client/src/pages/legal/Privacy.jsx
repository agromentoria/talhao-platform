import LegalPage from "./LegalPage";
import { EMPRESA } from "./empresa";

export default function Privacy() {
  return (
    <LegalPage title="Política de Privacidade">
      <p>Esta política explica como o Meu Talhão trata os seus dados pessoais, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>

      <h2>Quem é o responsável</h2>
      <p><strong>Controlador:</strong> {EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}, {EMPRESA.endereco}.<br />
        <strong>Encarregado de dados (DPO):</strong> {EMPRESA.encarregado} — <a href={`mailto:${EMPRESA.emailPrivacidade}`}>{EMPRESA.emailPrivacidade}</a>.</p>

      <h2>Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome, e-mail, telefone, senha (guardada criptografada), foto de perfil opcional.</li>
        <li><strong>Identificação e prevenção à lavagem de dinheiro:</strong> CPF ou CNPJ, endereço, documentos e informações sobre a origem dos recursos, quando exigidos.</li>
        <li><strong>Investimentos e pagamentos:</strong> sacas compradas, valores, forma de pagamento, recebimentos e dados para crédito (chave Pix ou conta).</li>
        <li><strong>Fazendas e armazéns:</strong> dados da propriedade (CAR, matrícula, área), talhões, custos, produtividade, apólice de seguro, fotos e diário da lavoura.</li>
        <li><strong>Uso do app:</strong> data de acesso, dispositivo e registros de segurança. Não usamos cookies de publicidade nem vendemos dados.</li>
      </ul>

      <h2>Para que usamos e com qual base legal</h2>
      <ul>
        <li><strong>Executar o contrato</strong> (art. 7º, V): criar a conta, registrar compras, calcular e fazer pagamentos, mostrar o andamento da safra.</li>
        <li><strong>Cumprir obrigações legais e regulatórias</strong> (art. 7º, II): verificação de identidade, prevenção à lavagem de dinheiro (Lei nº 9.613/1998), regras da CVM e obrigações fiscais.</li>
        <li><strong>Legítimo interesse</strong> (art. 7º, IX): segurança, prevenção a fraudes e melhoria do app, sempre com o mínimo de dados.</li>
        <li><strong>Consentimento</strong> (art. 7º, I): avisos de novidades e ofertas, que você pode desligar quando quiser.</li>
      </ul>

      <h2>Com quem compartilhamos</h2>
      <p>Só o necessário, com: a plataforma de investimento parceira registrada na CVM, a registradora dos títulos (CPR), o fundo gestor que aprova talhões e pagamentos, o armazém que guarda o grão, a seguradora do talhão, os meios de pagamento e os provedores de tecnologia (hospedagem e banco de dados em nuvem, que podem ficar fora do Brasil, com cláusulas de proteção — art. 33). Autoridades recebem dados apenas quando a lei exige.</p>
      <p>Quem investe vê o nome da fazenda e os dados do talhão; a fazenda não vê os seus dados de pagamento.</p>

      <h2>Por quanto tempo guardamos</h2>
      <p>Enquanto a conta estiver ativa e, depois, pelo prazo exigido por lei — em geral 5 anos para registros de operações e prevenção à lavagem de dinheiro, e o prazo fiscal aplicável. Passado esse prazo, os dados são apagados ou anonimizados.</p>

      <h2>Seus direitos (art. 18)</h2>
      <p>Você pode: confirmar se tratamos seus dados; acessar e <strong>baixar uma cópia</strong> (Perfil › Mais › Baixar meus dados); corrigir dados; pedir anonimização ou eliminação do que não for obrigatório guardar; saber com quem compartilhamos; revogar consentimentos; e pedir a <strong>exclusão da conta</strong> (Perfil › Mais). Pedidos também pelo e-mail <a href={`mailto:${EMPRESA.emailPrivacidade}`}>{EMPRESA.emailPrivacidade}</a>, respondidos em até 15 dias. Você também pode reclamar à ANPD.</p>

      <h2>Segurança e incidentes</h2>
      <p>Usamos conexão criptografada, senhas protegidas, acesso por perfil e registro das ações sensíveis. Se houver um incidente de segurança que possa causar risco ou dano relevante, comunicaremos a ANPD e as pessoas afetadas.</p>

      <h2>Menores de idade</h2>
      <p>O Meu Talhão é destinado a maiores de 18 anos. Não aceitamos cadastro de menores.</p>

      <h2>Mudanças nesta política</h2>
      <p>Quando houver mudança relevante, avisaremos no app antes de ela valer.</p>
    </LegalPage>
  );
}
