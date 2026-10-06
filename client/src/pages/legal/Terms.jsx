import LegalPage, { LEGAL_CONTACT } from "./LegalPage";

export default function Terms() {
  return (
    <LegalPage title="Termos de uso">
      <p>Ao criar uma conta no Meu Talhão você concorda com estes termos.</p>
      <h2>O que é a plataforma</h2>
      <p>O Meu Talhão conecta fazendas aprovadas pela administração a investidores que compram participação na produção de talhões específicos. A fazenda é responsável pela condução da lavoura e pelas informações publicadas.</p>
      <h2>Armazém garantidor</h2>
      <p>Talhões com o selo “Garantido por” têm um armazém credenciado que verifica, de forma independente da fazenda, o plantio, a colheita e a quantidade armazenada. O pagamento aos investidores só é liberado depois da armazenagem confirmada. O armazém responde pela veracidade das validações que registra; a garantia não cobre variação de preço de mercado.</p>
      <h2>Riscos</h2>
      <p>Investimentos no agro estão sujeitos a clima, pragas, produtividade e preço de mercado. Os retornos exibidos são estimativas e não garantem resultado. Invista apenas valores compatíveis com seu perfil.</p>
      <h2>Comissões</h2>
      <p>A fazenda e a plataforma cobram comissões percentuais sobre o lucro de cada colheita, exibidas antes da compra. Não há comissão sobre o valor investido.</p>
      <h2>Pagamento da colheita</h2>
      <p>A fazenda informa o resultado com comprovante. Quando há armazém garantidor, ele confirma a quantidade armazenada; a administração revisa tudo antes de liberar o pagamento aos investidores na conta cadastrada em Perfil › Recebimento.</p>
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
