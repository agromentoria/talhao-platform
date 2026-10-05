import LegalPage, { LEGAL_CONTACT } from "./LegalPage";

export default function Privacy() {
  return (
    <LegalPage title="Política de privacidade">
      <p>Esta política explica quais dados o Meu Talhão coleta, para que usa e quais são seus direitos pela Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
      <h2>Dados que coletamos</h2>
      <ul>
        <li>Cadastro: nome, e-mail, telefone, senha (guardada só como hash) e foto de perfil, se você enviar.</li>
        <li>Documentos para contrato: CPF ou CNPJ, RG, estado civil, profissão e endereço.</li>
        <li>Recebimento: chave Pix ou dados bancários informados por você.</li>
        <li>Cartões: apenas bandeira, 4 últimos dígitos e validade. Número completo e código de segurança não são armazenados.</li>
        <li>Uso da plataforma: investimentos, mensagens trocadas no app, avisos e registros de acesso exigidos pelo Marco Civil da Internet.</li>
        <li>Fazendas: dados da propriedade (CAR, matrícula, área) e fotos publicadas.</li>
      </ul>
      <h2>Para que usamos</h2>
      <ul>
        <li>Executar os investimentos, os pagamentos de colheita e os repasses de comissão.</li>
        <li>Elaborar contratos e cumprir obrigações legais, fiscais e regulatórias.</li>
        <li>Prevenir fraudes e manter a segurança das contas.</li>
        <li>Enviar avisos sobre talhões, safra e pagamentos dentro do app.</li>
      </ul>
      <p>Não vendemos dados pessoais e não usamos rastreamento para publicidade.</p>
      <h2>Com quem compartilhamos</h2>
      <p>Com a fazenda ou o investidor da outra ponta do investimento (apenas o necessário), com provedores de hospedagem, banco de dados e pagamento que operam em nosso nome, e com autoridades quando a lei exigir.</p>
      <h2>Por quanto tempo guardamos</h2>
      <p>Enquanto sua conta existir. Ao excluir a conta, apagamos ou anonimizamos seus dados pessoais; registros financeiros concluídos são mantidos de forma anonimizada pelo prazo legal.</p>
      <h2>Seus direitos</h2>
      <p>Você pode acessar, corrigir e exportar seus dados, revogar consentimentos e excluir sua conta pelo app em Perfil › Mais › Excluir conta. Para outros pedidos, escreva para <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.</p>
      <h2>Segurança</h2>
      <p>Usamos conexão criptografada (HTTPS), senhas com hash, controle de acesso por perfil e limites contra tentativas de invasão.</p>
    </LegalPage>
  );
}
