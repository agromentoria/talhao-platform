import { Link } from "react-router-dom";
import LegalPage from "./LegalPage";
import { EMPRESA } from "./empresa";

export default function Terms() {
  return (
    <LegalPage title="Termos de Uso">
      <p>Ao criar uma conta no Meu Talhão você concorda com estes termos, com a <Link to="/privacidade">Política de Privacidade</Link> e com os <Link to="/compliance">avisos de risco</Link>. O app é operado por {EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}.</p>

      <h2>O que é o Meu Talhão</h2>
      <p>Uma plataforma que conecta pessoas que querem financiar o plantio a fazendas que precisam de recursos antes da safra. Cada talhão é representado por uma Cédula de Produto Rural com liquidação financeira (CPR-F), oferecida por meio de {EMPRESA.plataformaCvm}, com a custódia do grão em armazém credenciado.</p>

      <h2>Como funciona para quem investe</h2>
      <ul>
        <li>Você compra sacas de um talhão pelo <strong>custo de produção da saca</strong> informado pela fazenda e conferido pelo fundo gestor. O preço sobe com o tempo para quem compra depois.</li>
        <li>Na colheita, recebe <strong>no mínimo 95% do CDI no prazo da safra</strong>, obrigação assumida pela fazenda na CPR. Quando a venda passa do valor indicado no talhão, recebe o custo mais <strong>30% do lucro</strong> de cada saca.</li>
        <li>O pagamento usa o <strong>preço público de referência</strong> da cultura (B3 ou Cepea), na janela e com a base regional definidas no talhão — não o preço que a fazenda declara.</li>
        <li>Você não paga taxa para comprar nem para receber.</li>
      </ul>

      <h2>Como funciona para a fazenda</h2>
      <ul>
        <li>Declara o talhão (área, cultura, custo por hectare, produtividade) e pode oferecer até 80% da produção esperada, com seguro agrícola e apólice anexada.</li>
        <li>Recebe os recursos antes do plantio, garante o mínimo dos investidores e fica com 65% do lucro e toda a produção que não vendeu.</li>
        <li>Paga ao app 1% do valor captado (na entrada) e 5% do lucro (na saída), além de custódia e gestão (0,15% cada) e da armazenagem.</li>
        <li>Em quebra de safra com sinistro reconhecido pela seguradora, o pagamento pode ser prorrogado, com o mínimo continuando a correr; sem sinistro, a obrigação continua sendo da fazenda.</li>
      </ul>

      <h2>Suas responsabilidades</h2>
      <ul>
        <li>Informar dados verdadeiros e mantê-los atualizados; guardar sua senha.</li>
        <li>Investir respeitando os limites anuais da regulação para investidores não qualificados.</li>
        <li>Não usar o app para fins ilícitos, inclusive lavagem de dinheiro.</li>
      </ul>

      <h2>Limites da nossa responsabilidade</h2>
      <p>O Meu Talhão estrutura, exibe e acompanha os talhões, mas não garante o resultado da safra nem o pagamento da fazenda. Retornos passados ou estimados não são promessa de rentabilidade. Leia os <Link to="/compliance">avisos de risco</Link>.</p>

      <h2>Suspensão e encerramento</h2>
      <p>Podemos suspender contas com indícios de fraude ou violação destes termos. Você pode encerrar a conta quando quiser; investimentos em andamento seguem até o pagamento.</p>

      <h2>Foro e lei aplicável</h2>
      <p>Lei brasileira. Foro de {EMPRESA.foro}, ressalvado o direito do consumidor de usar o foro do seu domicílio.</p>
    </LegalPage>
  );
}
