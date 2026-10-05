import LegalPage, { LEGAL_CONTACT } from "./LegalPage";

export default function Terms() {
  return (
    <LegalPage title="Termos de uso">
      <p>Ao criar uma conta no Meu Talhão você concorda com estes termos.</p>
      <h2>O que é a plataforma</h2>
      <p>O Meu Talhão conecta fazendas aprovadas pela administração a investidores que compram participação na produção de talhões específicos. A fazenda é responsável pela condução da lavoura e pelas informações publicadas.</p>
      <h2>Riscos</h2>
      <p>Investimentos no agro estão sujeitos a clima, pragas, produtividade e preço de mercado. Os retornos exibidos são estimativas e não garantem resultado. Invista apenas valores compatíveis com seu perfil.</p>
      <h2>Comissões</h2>
      <p>A fazenda e a plataforma cobram comissões percentuais sobre o lucro de cada colheita, exibidas antes da compra. Não há comissão sobre o valor investido.</p>
      <h2>Pagamento da colheita</h2>
      <p>A fazenda informa o resultado com comprovante. A administração revisa antes de liberar o pagamento aos investidores na conta cadastrada em Perfil › Recebimento.</p>
      <h2>Responsabilidades do usuário</h2>
      <ul>
        <li>Manter seus dados verdadeiros e atualizados.</li>
        <li>Guardar sua senha e não compartilhar a conta.</li>
        <li>Não usar as conversas para conteúdo ofensivo, ilegal ou enganoso.</li>
      </ul>
      <h2>Encerramento</h2>
      <p>Você pode excluir sua conta a qualquer momento pelo app, depois de concluídos os investimentos em andamento. Contas que violarem estes termos podem ser suspensas.</p>
      <h2>Contato</h2>
      <p><a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a></p>
    </LegalPage>
  );
}
