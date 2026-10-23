# Registro de mudanças

## 3.4.0 — mínimo do investidor em 95% do CDI

- O mínimo garantido sobe de 90% (igual à LCA) para **95% do CDI no prazo da safra**: o investidor fica sempre acima da LCA (6,55% contra 6,22% numa safra de soja de ~190 dias).
- Talhão de referência de 100 ha de soja a R$ 120: fazenda R$ 53,6 mil (banco: R$ 51,9 mil; barter: R$ 34,4 mil); app R$ 6,1 mil na entrada + R$ 5,3 mil na saída. Investidor passa a receber mais que o mínimo quando a venda passa de R$ 124,46.
- Talhões já publicados mantêm o mínimo com que foram vendidos; vale para os novos (ajustável por `CUSTO_MIN_PCT_CDI`).

## 3.3.0 — contrato completo: preço de liquidação, quebra de safra e limites

**Preço de liquidação pela referência pública (a fazenda não escolhe o preço)**
- Cada talhão "Custo + Lucro" guarda o índice da cultura (soja: B3 SJC / Cepea-Esalq Paranaguá; milho: B3 CCM / Cepea-Esalq Campinas; feijão, algodão, trigo, café, arroz e boi com seus indicadores), a **base regional** (diferença da praça) e a janela (média de 10 pregões a partir de 15 dias após a colheita prevista).
- A fazenda finaliza informando só a colheita; o **fundo informa a média do índice** (com a fonte), o app soma a base e calcula o preço de liquidação. O pagamento fica bloqueado até isso.
- A fazenda vende o grão físico quando e para quem quiser.

**Quebra de safra**
- O talhão só pode oferecer até **80% da produção esperada** (área × produtividade).
- Seguro agrícola no cadastro (seguradora, apólice, cobertura de 65% a 100%); o fundo vê na aprovação.
- **Prorrogação por sinistro reconhecido:** o fundo adia o pagamento para a nova colheita; o mínimo do investidor continua correndo e os investidores são avisados.
- Cascata explicada em cada talhão: limite de 80% → seguro → prorrogação com mínimo correndo → garantias da CPR e grão no armazém.

**Tamanho livre e tetos**
- O talhão tem a área que a fazenda declarar, com a cultura dele. Teto de **R$ 2,5 mi por talhão** e, para produtor pessoa física, **R$ 2,5 mi por safra** somando os talhões lançados.

**Tela do investidor em sacas**
- "Você paga · recebe no mínimo · recebe mais se a venda passar de R$ X (30% do lucro) · exemplo".

## 3.2.0 — duas taxas, simples de explicar

- O app ganha em **dois momentos**: **na entrada, 1% do valor captado** (pago pela fazenda, a cada compra) e **na saída, 5% do lucro da safra**. O lucro fica dividido em investidor 30% · fazenda 65% · app 5%.
- A taxa de desempenho sobre o ganho do investidor sai do padrão (`CUSTO_DESEMPENHO_PCT=0`; pode ser religada pela variável). O investidor não paga taxa para entrar nem para sair.
- Exemplo, 1.000 ha de soja a R$ 120: app R$ 61 mil na entrada + R$ 53 mil na saída; fazenda R$ 556 mil (banco: R$ 519 mil); investidor +6,22% (mínimo), +8,18% a R$ 130 e +11,11% a R$ 140.

## 3.1.0 — a plataforma ganha na entrada e na saída

Como no mercado de crowdfunding (taxa de sucesso paga por quem capta; taxa de desempenho sobre o ganho do investidor):

- **Entrada:** taxa de sucesso de **1% sobre cada compra** num talhão Custo + Lucro, paga pela fazenda e registrada na hora (`taxa_estruturacao`). O investidor não paga nada para entrar.
- **Saída:** **5% do lucro** da safra (como antes) **+ taxa de desempenho de 10% sobre o ganho do investidor acima do mínimo** (o mínimo igual à LCA nunca é tocado).
- Exemplo, 1.000 ha de soja a R$ 120: plataforma R$ 61 mil na entrada + R$ 53 mil na saída = **1,87% do captado**; a R$ 140, 3,34%. Fazenda R$ 556 mil (banco: R$ 519 mil); investidor +6,22% (mínimo) a +10,63%.
- Quadro de regras mostra "Como a plataforma ganha" (entrada e saída) e a receita da plataforma em cada cenário; Financeiro separa receita de entrada e de saída; carteira e demonstrativo da fazenda descontam a taxa de entrada.
- Carga de um ano com a taxa de entrada em cada compra. Novos parâmetros: `CUSTO_ESTRUTURACAO_PCT` (padrão 1) e `CUSTO_DESEMPENHO_PCT` (padrão 10).

## 3.0.0 — modelo "Custo + Lucro"

O investidor passa a ser sócio da safra: financia o custo de produção e divide o lucro.

- **Talhões novos** com custo por hectare e produtividade esperada nascem no modelo `custo`. Talhões antigos (piso e meta) continuam como estavam.
- **Preço de compra = custo de produção por saca** (custo/ha ÷ produtividade; ex.: soja R$ 6.122/ha ÷ 59,9 sc/ha = R$ 102,15), subindo com o tempo para quem compra depois.
- **Na venda, o lucro de cada saca (preço − custo) é dividido:** 65% fazenda · 30% investidor · 5% plataforma. **Mínimo do investidor:** 90% do CDI no prazo (equivalente à LCA), garantido pela fazenda. **Toda saca produzida além das financiadas é da fazenda.**
- **A fazenda paga 0,8% sobre o captado** (0,5% estruturação, 0,15% custódia, 0,15% gestão) e a armazenagem.
- Exemplo, 1.000 ha de soja vendida a R$ 120: investidor +6,22% (mínimo), fazenda R$ 586 mil (com banco a 18% a.a.: R$ 519 mil), plataforma R$ 84 mil.
- **Cadastro:** campos de custo por hectare e produtividade esperada; quadro com custo por saca, margem, divisão do lucro e cenários de preço com o resultado da fazenda por hectare e no talhão; aviso de **margem insuficiente** quando o preço esperado não cobre o custo + o mínimo.
- Página do talhão, vitrine, aprovação e pagamento do fundo, finalização da fazenda e demonstrativo no modelo novo; pagamento fecha ao centavo com a venda.
- **Carga de um ano** (`carga-ano-completo.js`) no modelo novo, com custos Imea/Conab 2026/27 por cultura.
- Regras ajustáveis: `CUSTO_MIN_PCT_CDI`, `CUSTO_LUCRO_INVESTIDOR_PCT`, `CUSTO_LUCRO_FAZENDA_PCT`, `CUSTO_LUCRO_PLATAFORMA_PCT`, `CUSTO_ESTRUTURACAO_PCT`, `CUSTO_CUSTODIA_ARMAZEM_PCT`, `CUSTO_GESTAO_FUNDO_PCT`.

## 2.7.0 — carga de demonstração: um ano do app em operação

- Novo script `scripts/carga-ano-completo.js` (`npm run carga:ano`): simula de ago/2025 a out/2026 com **safra 2025/26 e safrinha 2026 colhidas e pagas**, **safra 2026/27 plantada** (captação quase esgotada, com lista de espera) e **safrinha 2027 em captação**.
- **20 fazendas, 4 armazéns** (o SIAP existente + Silos Norte Mato Grosso, Armazéns Gerais Cone Sul e Armazém Vale do Paranaíba, cada fazenda ligada ao da sua região), **~4.000 investidores** pessoa física de todo o país.
- **Compras pulverizadas:** 70 a 110 compradores por talhão, compra média de ~R$ 1,8 mil (75% até R$ 1.200), recompra entre safras e indicação.
- Produto com renda mínima, preço do dia e pagamento com a mesma conta do app; custos lançados, diário da lavoura, validações dos armazéns, notificações e bônus de indicação.
- Resultado da carga: ~R$ 12 mi captados no ano; investidores +6,8% nas safras pagas; fazendas com custo do dinheiro de ~7,4%.
- Gravação em lote numa única transação (alguns minutos no Neon); rodar de novo recria do zero; `REMOVER=1` apaga. Substitui a carga anterior (`carga-safrinha-2027.js`), que é removida automaticamente.

## 2.6.2 — safrinha 2026 colhida e paga na carga de demonstração

- A carga `carga-safrinha-2027.js` agora também cria **12 talhões da safrinha 2026 já colhidos, vendidos e pagos** (milho, feijão, sorgo e trigo), comprados pela ana.cedo@demo.com e pagos pela mesma rotina do app. Preços reais de venda entre −8% e +21% sobre a referência: nos casos de queda, a Ana recebe o piso e a fazenda completa.
- Resultado da carga: investidora +7,98% em ~200 dias; fazendas com custo do dinheiro de 8,13% no período (contra 9,0% a 10,5% do crédito bancário livre) e R$ 61 mil de parte da alta. `SEM_COLHIDOS=1` desliga.
- **Carteira da fazenda** no produto com piso: "Recebido nas colheitas", "Piso dos investidores e taxas pagos" e o resultado por talhão sem contar a armazenagem duas vezes.

## 2.6.1 — carga de demonstração da safrinha 2027

- Novo script `npm run carga:safrinha` (pasta `server`): 20 fazendas do cinturão da safrinha (MT, GO, MS, PR, MG) e 58 talhões de milho, sorgo, feijão, algodão e trigo, em preparo do solo ou plantio, no produto com renda mínima.
- Valores de mercado (referência out/2026 para jul/2027): milho ~R$ 58/sc e 100–125 sc/ha; sorgo ~R$ 47/sc; feijão carioca ~R$ 280/sc; algodão ~R$ 128/@; trigo ~R$ 76/sc; custos por hectare por cultura; 55% a 70% da produção vendida aos investidores, até R$ 2,4 mi por talhão.
- Grava direto no banco com as regras do app (piso, custódia do armazém SIAP com as tarifas dele, aprovação e publicação); precisa só da `DATABASE_URL`. Compras da investidora ana.cedo@demo.com em ~30% dos talhões (desligue com `SEM_COMPRAS=1`); `REMOVER=1` desfaz a carga.

## 2.6.0 — produto com renda mínima (piso)

O app passa a funcionar como o plano de negócios v2 e a apresentação.

- **Talhões novos e novos ciclos nascem no produto com piso** (`modelo = 'piso'`). Talhões antigos e safras já pagas continuam na regra anterior (meta, comissão e performance).
- **Piso:** 95% do CDI no prazo da safra (da abertura da captação até a colheita prevista + 30 dias), pago pela fazenda mesmo se o preço cair. Calculado ao publicar o talhão.
- **Alta acima do preço-piso:** 30% investidor · 60% fazenda · 10% plataforma.
- **A fazenda paga** 1% de estruturação (plataforma), 0,15% de custódia (armazém), 0,15% de gestão (fundo) e a armazenagem; o investidor recebe sem descontos.
- **Preço da saca sobe com o tempo, na taxa do piso** (não por fase): quem compra em qualquer dia tem o mesmo piso de 95% do CDI pelo prazo que falta e nunca fica abaixo da LCA no mesmo prazo.
- **Pagamento da colheita e prévia do fundo** com a mesma conta; fecha ao centavo com o valor da venda. Novos lançamentos: `aporte_fazenda` (quando a venda não cobre o piso) e `gestao_fundo`.
- **Telas:** quadro "Renda mínima garantida" (preço e mínimo hoje e daqui a 30/60/90 dias, esperado com a alta, comparação com LCA, CDB e poupança no mesmo prazo); painel de compra com recebimento mínimo garantido; vitrine com "renda mínima na safra"; cadastro sem meta e performance, com o custo da fazenda comparado ao banco; prévia de "Aprovar e pagar" e demonstrativo com a nova divisão; "Como funciona" e simulador reescritos.
- Regras ajustáveis por variáveis de ambiente (`PISO_PCT_CDI`, `PISO_ESTRUTURACAO_PCT`, `PISO_CUSTODIA_ARMAZEM_PCT`, `PISO_GESTAO_FUNDO_PCT`, `PISO_EXC_INVESTIDOR_PCT`, `PISO_EXC_FAZENDA_PCT`, `PISO_EXC_PLATAFORMA_PCT`, `PISO_DIAS_POS_COLHEITA`, `REF_CDI_AA`).

## 2.5.0 — lista de espera e indicação (preparação para crescimento viral)

- **Lista de espera** nos talhões esgotados: o investidor escolhe quantas sacas quer e vê a posição na fila; quando a mesma fazenda ou outra fazenda abre um talhão da mesma cultura, todos da lista recebem o aviso primeiro. A barra de compra do celular vira "Avise-me".
- **Demanda reprimida** no painel do fundo e da administração: quantas pessoas e sacas esperam, por cultura e fazenda — para priorizar a aprovação de novos talhões.
- **Programa de indicação:** cada usuário tem um código (ex.: MT4CAE) e um link de convite; "Indique e ganhe" no Meu armazém com convite pelo WhatsApp. Na 1ª compra de quem foi indicado, os dois ganham crédito (R$ 20 cada, ajustável por `BONUS_INDICADOR` e `BONUS_INDICADO`); o indicador recebe um aviso. O crédito fica registrado e passa a abater compras quando o meio de pagamento real entrar.
- Cadastro mostra "Você foi convidado" quando a pessoa chega pelo link.

## 2.4.1 — carga de talhões da Fazenda Boa Vista

- Novo script `npm run seed:boa-vista` (pasta `server`): cria 5 talhões diversificados da Fazenda Boa Vista (Rio Verde, GO) com preços, produtividades, custos e ciclos de mercado de out/2026, via API (funciona no local e no servidor publicado; pode ser rodado de novo sem duplicar).
  - Soja precoce (250 ha, 11.000 sc a R$ 120, meta 9%, plantada, com custos e diário);
  - Feijão carioca irrigado (120 ha, 3.600 sc a R$ 280, meta 7%, ciclo de 90 dias);
  - Confinamento de 1.000 Nelore (6.000 @ a R$ 350, meta 8%, animais entrados);
  - Milho safrinha (20.000 sc a R$ 58) e algodão (14.000 @ a R$ 130) aguardando o fundo: em ciclos longos a captação deve abrir perto do plantio.
  - `COM_COMPRAS=1` simula compras dos investidores de demonstração.

## 2.4.0 — ganhos por safra

- **Tudo passa a ser contado por safra, não ao ano.** O quadro de regras mostra o ganho na safra por fase de compra e o **prazo em dias** até o pagamento (ciclo da cultura + armazenagem e venda), no lugar da taxa equivalente ao ano.
- **Comparação no mesmo prazo:** "No mesmo prazo de N dias, o mesmo dinheiro renderia: Meu Talhão X%, LCA Y%, CDB Z% (após IR), poupança W%" — na página do talhão, no cadastro (fazenda) e na aprovação (fundo).
- **Ciclo típico por cultura** no catálogo (soja ~120 dias, milho ~150, feijão ~90, arroz ~130, trigo ~120, algodão ~170, café ~365, bovinos de corte ~120, leite ~300, suínos ~110, frango ~45, poedeiras ~365). O cadastro mostra o ciclo típico e o ciclo do talhão pelas datas.
- **Simulador do "Como funciona"** com a duração da safra em dias e a comparação em reais com LCA, CDB e poupança no mesmo prazo.
- Taxas de referência (CDI, % da LCA, poupança) em `/api/regras`, ajustáveis por `REF_CDI_AA`, `REF_LCA_PCT_CDI` e `REF_POUPANCA_AM`.

## 2.3.0 — teste de carga e escalabilidade

Testado com volume sintético de anos de operação (20 mil investidores, 1.200 talhões, 200 mil compras e 200 mil transações) e carga de 20 conexões simultâneas.

- **Corrigido (crítico):** com muitas compras simultâneas, cada compra segurava a conexão com o banco enquanto enviava avisos, que precisavam de outras conexões; o pool esgotava e o servidor inteiro parava (até o login). A conexão agora é devolvida logo após a confirmação. Teste: 60 compras simultâneas por 100 sacas → exatamente 20 aceitas (100 sacas), 40 recusadas, nenhuma venda duplicada.
- Pool de conexões com limite configurável (`PG_POOL_MAX`, padrão 20) e tempo máximo de espera de 10 s, para falhar com erro claro em vez de travar.
- 11 índices novos (transações por talhão, fazenda, data, tipo e investimento; pagamentos; validações; investimentos por situação; usuários por perfil; talhões por situação).
- Rankings de usuários reescritos com agregação única (antes: uma subconsulta por usuário).
- Resumo do financeiro sem juntar tabelas quando os filtros não exigem.
- Vitrine com cache de 10 s já serializado e **respostas comprimidas (gzip)**: a vitrine de 900 talhões caiu de ~1 MB para ~29 KB.
- Mensagem clara quando as sacas esgotam.

| Tela | Antes | Depois (20 conexões, 1 vCPU) |
| --- | --- | --- |
| Demonstrativo | 49 req/s · 393 ms | 486 req/s · 37 ms |
| Financeiro (transações) | 3 req/s · 4,2 s | 26 req/s · 0,76 s (40 ms com 1 usuário) |
| Vitrine | 31 req/s · 631 ms | 113 req/s · 152 ms |
| Rankings de usuários | sem resposta | 0,14–0,43 s com 1 usuário |

## 2.2.0 — gestão de usuários na administração

- **Novo menu "Usuários"** (só administração), com abas **Investidores**, **Fazendas**, **Armazéns** e **Fundo**:
  - busca por nome, e-mail, cidade, responsável ou CNPJ; filtros por situação, estado (UF), período de cadastro e faixa de valor; tudo guardado no endereço da página;
  - **ordenação = ranking**: quem mais investiu/recebeu, fazenda com mais talhões, maior área, mais captação, mais investidores; armazém que mais armazena, mais valor garantido, mais tarifas; membro do fundo com mais pagamentos aprovados;
  - **resumo** do recorte e **gráfico do top 10** com valores;
  - **ficha** de cada um: métricas (investido, lucro realizado, ticket médio; talhões, área, captado, custos; armazenado em unidades e toneladas, ocupação da capacidade, custódias; aprovações do fundo), lista de compras/talhões/custódias/pagamentos e atalho para as transações no Financeiro;
  - ações na ficha: aprovar/suspender fazendas e armazéns; **suspender e reativar o acesso** de investidores e membros do fundo;
  - **exportar CSV** e **imprimir** o relatório da aba, com os filtros aplicados.
- **Suspensão de acesso**: conta suspensa não entra e perde o acesso na hora, mesmo já logada (verificação com cache de 30 s). Motivo fica registrado.
- **Último acesso** de cada usuário passa a ser registrado.
- Aprovação de talhões registra quem aprovou (base para o ranking do fundo).
- No celular, a barra da administração passa a ser: Admin, Usuários, Financeiro, Conversas, Perfil.

## 2.1.1 — ícones definitivos da marca

- Ícones finais do designer no lugar dos provisórios: saca genérica, saca com grãos (Primeira saca), sacas com trigo (10 sacas), armazém (100 sacas), cuidando da terra (Acompanhou o plantio), colhendo (Primeira colheita), produtor (3 culturas) e produtor na fazenda (Amigo do campo).
- Boas-vindas usam a saca, o armazém e a cena da colheita novos.
- Ilustração das fazendas trocada por PNG: de ~475 KB para ~49 KB, abrindo mais rápido nas listas e conversas.
- Ilustrações PNG entram no cache do app (abrem mesmo com internet fraca).

## 2.1.0 — "Meu armazém" do investidor e ícones da marca

- **Nomenclatura:** a área do investidor passou a ser **"Meu armazém"** — onde ficam as commodities que ele comprou (grãos, fibras, animais). "Na roça" virou **"No armazém"**, "Colhidas e pagas" virou **"Vendidas e pagas"**, "Diário da roça" virou **"Diário do talhão"** e "A roça está em" virou **"O talhão está em"**.
- O resumo do armazém soma por unidade (ex.: "60.000 sacas · 1.200 arrobas"), sem misturar soja com boi.
- **Sacas com os desenhos da marca:** a pilha usa a saca de cada cultura, o boi ou a vaca na pecuária, e a **saca do logo** quando a cultura não tem desenho próprio. O certificado também.
- **Conquistas com ilustrações:** Primeira saca (saca do logo com grão), 10 sacas (big bag com o símbolo), 100 sacas (armazém), Acompanhou o plantio (talhão germinando), Primeira colheita (colheitadeira), 3 culturas (produtor) e Amigo do campo (produtor na fazenda).
- Boas-vindas com ilustrações em vez de emojis e a explicação do "seu armazém no app".
- Novos arquivos em `client/public/icons/` e guia `docs/ICONES.md` para o designer substituir os provisórios mantendo o nome.

## 2.0.0 — operação pelo fundo e experiência lúdica para o investidor

### Perfil "Fundo"
- Novo tipo de acesso **Fundo**, criado pela administração em **Administração › Equipe do fundo** (nome, e-mail e senha provisória; remoção a qualquer momento).
- O fundo opera: **aprovar talhões**, **aprovar e pagar colheitas**, **Financeiro** completo (transações, relatórios, exportação), **preço por fase** e **referências de mercado**, avisos e conversas com todos.
- O fundo **consulta** fazendas e armazéns, mas não aprova nem suspende; não vê "Zerar dados", Pontuação nem Equipe.
- A **administração mantém acesso a tudo**, inclusive às telas do fundo. Avisos de talhão para aprovar, colheitas e divergências do armazém chegam para administração e fundo.

### Investidor: comprar saca ficou simples e divertido
- Linguagem do dia a dia: **"Minhas sacas"**, **"Comprar sacas"**, "Na roça", "Colhidas e pagas".
- **Sacas desenhadas na tela**: uma a uma até 10, montes com o número acima disso — na compra e em Minhas sacas.
- **Compra rápida** com botões +1, +5 e +10 e o valor de 1 saca à vista; botão "Comprar 6 sacas · R$ 727,20".
- **Minhas sacas**: total na roça, quanto valem hoje e a variação desde a compra, já recebido nas colheitas; compras do mesmo talhão agrupadas.
- **Conquistas**: Primeira saca, 10 sacas, 100 sacas, Viu plantar, Primeira colheita, 3 culturas, Amigo do campo.
- **Diário da roça** na página do talhão: avanços da fazenda com recados e confirmações do armazém, em linguagem simples.
- **Certificado de participação** em imagem (1080×1350) para guardar ou mandar no WhatsApp.
- **Boas-vindas em 3 telas** para quem está chegando (aparece uma vez).

### Correções
- Números grandes nos cartões e valores nas listas não quebram mais no meio.
- Textos invisíveis das conquistas causavam rolagem lateral no celular.

## 1.9.2 — performance pelo preço de venda

- **Regra da performance mudou:** o excedente passa a ser medido pelo **preço de venda acima da meta × quantidade**. Antes ele era medido sobre o lucro já descontada a armazenagem, e uma venda acima da meta podia não gerar performance (ex.: meta R$ 144, venda R$ 145, 60.000 sacas, armazenagem dividida → performance R$ 0). Agora o mesmo caso gera excedente de R$ 60.000 e R$ 24.000 para a fazenda (40%).
- Proteção do investidor mantida: o excedente nunca passa do lucro dele. A armazenagem segue a divisão combinada no talhão.
- A finalização da colheita envia o retorno com precisão alta, para o preço declarado ser reproduzido ao centavo (antes R$ 145,00 virava R$ 144,996).
- Textos atualizados no cadastro, no "Como funciona", nos Termos de uso e no motivo exibido na prévia de pagamento.
- Vale para os pagamentos aprovados a partir desta versão.

## 1.9.1 — performance visível em "Aprovar e pagar"

- A prévia do pagamento da colheita mostra a fazenda em linhas separadas: **comissão até a meta**, **performance acima da meta** e **total**. Quando a performance é zero, aparece o motivo (sem performance definida no talhão, venda não passou da meta, ou excedente consumido por armazenagem/fase da compra).
- O cabeçalho da prévia informa quanto a venda ficou acima ou abaixo da meta e qual a performance definida.
- A confirmação "Aprovar e pagar" repete os valores de cada participante, e o aviso final informa a performance paga à fazenda.

## 1.9.0 — regras de ganhos, percentuais e comissões claras para todos

- **Novo quadro "Regras deste talhão"**, calculado com os números de cada talhão e igual para todos:
  - meta de venda em reais (preço de referência + retorno prometido);
  - tabela por fase: quanto o investidor paga, recebe, ganho líquido no período e taxa equivalente ao ano (pelas datas do ciclo e da armazenagem);
  - quem fica com o lucro até a meta e acima dela (investidor, fazenda, plataforma);
  - exemplo com 100 unidades vendidas na meta e 10 pontos acima.
- O quadro aparece **no cadastro do talhão** (atualiza enquanto a fazenda digita), **na página do talhão** (com a fase atual destacada) e **na aprovação da administração**.
- **Rótulos mais claros:** "Retorno estimado ao investidor" passou a "Retorno prometido — meta de venda", com explicação e exemplo; o card da vitrine mostra "meta de retorno".
- **Nova página "Como funciona"** (`/como-funciona`), pública: participantes, preço de referência, meta, preço por fase (com os fatores atuais), comissões, performance, armazenagem, pagamento, riscos e um **simulador** para testar qualquer cenário. Links na vitrine, no cadastro, no quadro de regras e em Perfil › Mais.
- Novo endereço público `/api/regras` (comissão da plataforma, fatores por fase, limite de performance, níveis).
- Correções: fatores por fase com resíduo da precisão antiga (1,0099999 → 1,01); valores longos nas listas quebram de linha sem estourar a tela no celular.

## 1.8.0 — demonstrativo financeiro e performance no financeiro

- **Performance da fazenda como lançamento próprio:** o pagamento da colheita agora registra "Comissão da fazenda" (até a meta) e "Performance da fazenda" (acima da meta) separadamente. No Financeiro da administração a performance aparece na lista, nos filtros, no gráfico, nos relatórios por fazenda e por talhão e na exportação.
- **Demonstrativo financeiro do talhão** (`/talhao/:id/demonstrativo`), visível para investidores e fazenda:
  - recebido dos investidores, custos lançados (e % aplicado), saldo da captação e resultado da fazenda;
  - custos por etapa — preparo do solo, sementes, fertilizantes, plantio, defensivos, manejo, colheita, frete, mão de obra, máquinas, arrendamento, seguro (categorias próprias para pecuária e produção animal) — com orçamento previsto × realizado;
  - lista de lançamentos com data e descrição; custo por hectare e por unidade;
  - divisão do resultado da venda (real após a colheita ou simulada na meta antes dela): investidores, comissão e performance da fazenda, armazém e plataforma;
  - impressão em PDF.
- A **fazenda lança custos e o orçamento** direto no demonstrativo (atalho "Demonstrativo e custos" em cada talhão do painel).
- **Carteira da fazenda reorganizada:** recebido dos investidores, custos, comissão, performance, armazenagem e resultado; lista "Por talhão" com o resultado de cada um; movimentações separando comissão e performance.
- A página do talhão ganhou o card "Demonstrativo financeiro" com o resumo e o link para o completo.
- Números grandes não estouram mais os cartões no celular.

## 1.7.2 — finalização pelo preço de venda e precisão dos valores

- **Corrigido:** o campo "Retorno final do ciclo (%)" da finalização vinha preenchido com o retorno prometido. Se a fazenda não alterasse, a venda era registrada exatamente na meta e a performance acima da meta ficava zerada. Agora a fazenda informa o **preço médio de venda por unidade** (campo vazio, obrigatório) e o app calcula o retorno, mostrando na hora se ficou acima da meta e a performance estimada da fazenda.
- **Prévia do pagamento para a administração:** antes de aprovar, a colheita mostra o preço declarado, a meta e quanto recebem investidores, fazenda (com a parte de performance), armazém e plataforma — a mesma conta do pagamento real.
- **Corrigido:** valores em dinheiro eram gravados com precisão simples (cerca de 7 dígitos) e perdiam os centavos acima de ~R$ 100 mil (ex.: 8.036.718,88 virava 8.036.719,00). Todas as colunas numéricas passam para precisão dupla automaticamente ao iniciar o servidor, e os valores são gravados em centavos exatos. Valores já gravados antes desta versão mantêm o arredondamento antigo.

## 1.7.1 — correção na aprovação de talhões

- **Corrigido:** talhão aguardando aprovação sumia da aba "Aprovar talhões" quando a fazenda registrava o andamento da safra (ex.: Plantio) antes da aprovação. Ele mudava para "em andamento" e a lista só mostrava talhões "em captação", deixando o talhão preso. Agora a lista e o contador incluem os dois casos, e o cartão mostra o andamento já informado.
- Versão do app visível em Perfil › Mais e em `/api/health` (ajuda a conferir se o deploy subiu).

## 1.7.0 — armazenagem dividida entre fazenda e investidores

- Nova opção **Dividir** em "Quem paga a armazenagem", ao lado de Investidores e Fazenda. A fazenda informa a parte dos investidores (1% a 99%) e o formulário mostra quanto cada lado paga.
- No pagamento da colheita, cada investidor tem descontada só a parte dele (antes das comissões); a parte da fazenda aparece na carteira dela como despesa.
- O investidor vê "Armazenagem estimada (sua parte: X%)" no painel de compra e a divisão no card da garantia; a administração vê a divisão antes de aprovar o pagamento.
- Valores à direita nas listas não quebram mais de linha (ex.: "− R$ 1,75").

## 1.6.0 — performance da fazenda acima da meta

- **Nova regra de divisão do lucro.** Até a meta (retorno prometido no talhão), o lucro segue as comissões padrão. O que passar da meta é dividido pela regra de performance: a fazenda fica com o percentual que ela definiu, o app mantém a sua comissão e o resto vai ao investidor.
- **A fazenda define** o percentual (0% a 70%) no cadastro do talhão e no novo ciclo, com exemplo calculado na hora.
- **A administração valida** na aprovação do talhão (aviso quando passa de 50%). Se a fazenda mudar a regra de um talhão já aprovado, ele sai da vitrine e volta para aprovação. Com investidores, a regra não muda mais.
- **O investidor vê a regra antes de comprar**: card "Como o lucro é dividido" com a meta em reais por unidade, a divisão até e acima da meta e um exemplo; a confirmação da compra repete a regra.
- **Pagamento da colheita** aplica a divisão e mostra a performance na descrição do repasse da fazenda e no detalhe do Financeiro. O excedente é medido sobre o lucro já descontada a armazenagem.
- Percentuais exibidos no formato brasileiro (7,5%).
- Termos de uso atualizados.

## 1.5.0 — financeiro da administração e zerar dados

- **Nova tela Financeiro** (`/admin/financeiro`, no menu da administração) com **todas as transações** da plataforma.
- **Busca** por nome, e-mail, fazenda, talhão, armazém, descrição ou número (#123).
- **Filtros** combináveis: período (atalhos 7 dias, 30 dias, mês, ano ou datas livres), tipo de transação, investidor, fazenda, armazém, talhão, forma de pagamento e faixa de valor. Os filtros ficam no endereço da página (dá para salvar e compartilhar o link).
- **Resumo** do recorte: entradas, saídas, receita da plataforma e quantidade; **gráfico mensal** por tipo.
- **Lista** com ordenação e paginação (tabela no computador, cartões no celular) e **detalhe** de cada transação, incluindo o investimento ligado e a composição do pagamento (venda, armazenagem, comissões, líquido).
- **Relatórios** agrupados por fazenda, investidor, armazém, talhão ou mês, com totais; tocar numa linha abre as transações dela.
- **Exportação CSV** (abre no Excel em português) da lista ou do relatório, sempre com os filtros aplicados; no celular usa a folha de compartilhamento.
- **Impressão / PDF** do relatório com cabeçalho, filtros aplicados e layout próprio para papel.
- **Zerar dados** em três níveis (só financeiro; financeiro + talhões; tudo menos a administração), com senha, palavra ZERAR, registro de quem fez e opção de desligar no servidor com `DISABLE_DATA_RESET=true`.

## 1.4.1 — correções encontradas na revisão das telas

- **Celular:** a página do talhão ficava mais larga que a tela (etapas, card de garantia e gráfico empurravam a coluna), fazendo a página rolar para o lado e cortando o diálogo de confirmação. Colunas e formulários agora respeitam a largura em qualquer celular (testado em 360 e 390 px, todas as telas).
- **Servidor:** o limite geral de requisições (300 a cada 15 min por IP) era baixo para várias pessoas na mesma rede de uma fazenda; agora é 1.500 (ajustável por `RATE_LIMIT_MAX`), com mensagem em português. O endereço de saúde (`/api/health`) fica fora do limite.

## 1.4.0 — despesa de armazenagem

- **Tabela de tarifas do armazém** (em Dados do armazém): recepção por unidade (recebimento, limpeza, secagem, expedição), armazenagem por unidade a cada quinzena, quinzenas de carência e quebra técnica (% por quinzena) — o mesmo formato usado pelos armazéns gerais.
- A tabela é **fixada no talhão no aceite da custódia**: mudanças posteriores valem só para novas custódias.
- No cadastro do talhão a fazenda define **quem paga** (investidores, descontado do resultado antes das comissões, ou a própria fazenda) e o **tempo previsto no armazém**, vendo a estimativa por unidade e no total.
- **Cobrança pelo tempo real**: conta da confirmação da armazenagem até a aprovação do pagamento.
- No pagamento da colheita: despesa descontada de cada investidor quando for o caso, transação "Tarifa de armazenagem" creditada ao armazém e detalhe na descrição do pagamento.
- Investidor vê a despesa estimada no painel de compra e no card "Garantia do armazém"; a administração vê a despesa até o dia antes de aprovar; a carteira da fazenda mostra a armazenagem; o painel do armazém mostra as tarifas recebidas.
- Correções: concordância "da safra"/"do ciclo"; mensagem clara quando a lista de cidades (IBGE) não carrega.

## 1.3.2 — listas de fazendas e armazéns padronizadas na administração

- Fazendas e armazéns usam o mesmo componente de lista: ícone, nome, situação, estrelas, identificação (cidade, CNPJ), responsável com e-mail, números do negócio e ações.
- Particularidades preservadas: fazenda mostra CAR, área, talhões ativos, valor captado e comissão (ações Aprovar/Suspender/Reativar); armazém mostra capacidade, custódias ativas e pedidos pendentes (ações Credenciar/Suspender/Reativar).
- Filtro por situação (Aguardando, Ativos, Suspensos) nas duas listas, com os pendentes no topo.

## 1.3.1 — aprovação de talhões mais fácil de achar

- Aba renomeada para **Aprovar talhões** (antes "Talhões", que se confundia com a vitrine).
- Aviso na Visão geral da administração com atalho "Revisar agora" quando há talhão esperando.
- O aviso "Talhão para aprovar" abre direto a aba de aprovação (`/admin?aba=talhoes`).
- Na página de um talhão em análise, o administrador vê o botão "Revisar e aprovar".

## 1.3.0 — culturas, ciclo, aprovação de talhões, nível do investidor e nota dos armazéns

- **Cultura e variedade** no lugar de "Grão": 13 culturas (grãos, café, fibras, pecuária e aves) com variedades (ex.: feijão preto, arroz agulhinha, milho pipoca, Nelore, Holandesa, poedeiras). A fazenda pode digitar cultura ou variedade fora da lista. Catálogo em `server/src/culturas.js`, servido em `GET /api/culturas`.
- **Tipos de produção** (lavoura, pecuária de corte, produção animal) com nomes próprios para as 6 fases e para as validações do armazém (ex.: "Entrada dos animais", "Abate ou venda").
- **Unidade de venda conforme a cultura**: saca, arroba, kg, litro, dúzia, tonelada, caixa, cabeça. Textos de preço e quantidade usam a unidade certa.
- **Ciclo obrigatório**: prazo do plantio (ou entrada dos animais) e data prevista da colheita (ou venda).
- **Controle de publicação**: todo talhão novo exige armazém garantidor e aprovação da administração. A administração é avisada a cada cadastro, aprova ou pede ajustes; o talhão só aparece e só aceita investimento depois de aprovado **e** com a custódia aceita. Talhões anteriores seguem publicados.
- **Nível do investidor**: Iniciante, Intermediário (a partir de R$ 5 mil) e Profissional (a partir de R$ 50 mil), com selo no perfil, na barra lateral e em Meus investimentos, e progresso até o próximo nível.
- **Pontuação dos armazéns** (0–5 estrelas): estrutura, tecnologia, segurança, certificações e capacidade estática. Pesos editáveis pela administração na aba Pontuação.
- Vitrine filtra só pelas culturas com talhão aberto; avisos de compra usam a unidade correta.

## 1.2.0 — perfil Armazém (garantidor da commodity)

- **Novo tipo de conta: Armazém.** Cadastro com CNPJ e localização; entra em análise até a administração credenciar.
- **Custódia:** ao publicar um talhão, a fazenda escolhe um armazém credenciado (obrigatório quando existe algum). O armazém aceita ou recusa com motivo; a fazenda pode indicar outro enquanto a custódia não for aceita.
- **Validações independentes** em três etapas: plantio (liberada na fase Plantio), colheita e armazenagem (liberadas na fase Colheita), com resultado "confere" ou "divergência", quantidade, observação e foto. Fazenda, investidores e (em divergência) a administração são avisados.
- **Pagamento travado:** com armazém garantidor, a administração só consegue aprovar o pagamento depois da armazenagem confirmada; a tela mostra quantidade armazenada × declarada × vendida.
- **Para o investidor:** selo "Garantido por" na vitrine e na página do talhão, card "Garantia do armazém" com a linha do tempo das validações, e aviso claro quando o talhão não tem garantidor.
- **Painel do armazém** (`/armazem`): pedidos, talhões em acompanhamento, concluídos e recusados; edição de capacidade e apresentação.
- **Administração:** aba Armazéns (credenciar/suspender) e novos números na visão geral.
- **Conversas:** armazém fala com as fazendas que o indicaram e com a administração.
- Exclusão de conta do armazém bloqueada enquanto houver custódia em andamento.
- Termos de uso e Política de privacidade atualizados; script `npm run seed:armazem` para demonstração.

## 1.1.0 — reorganização, correções e preparação para as lojas (out/2026)

### Erros corrigidos
- **Fotos do talhão não apareciam para o investidor.** A API devolve as fotos fora do objeto do talhão e a tela procurava no lugar errado.
- **Margem bruta aparecia negativa** enquanto o lucro estimado era positivo. A tela agora usa o mesmo cálculo do pagamento real (preço de referência × retorno estimado).
- **Comissão (fazenda e administração) disparava uma requisição a cada pixel arrastado**, estourando o limite da API. Agora salva ao soltar o controle.
- **Fotos de celular eram recusadas** (3–8 MB contra limite de 1,2 MB). Agora são reduzidas no aparelho antes do envio.
- **Dois botões "entrar"** na barra inferior para visitantes; **6 abas** para fazendas (limite recomendado: 5).
- **Zoom automático no iPhone** ao tocar em campos com fonte menor que 16 px.
- **Etapas da safra cortadas** no celular; painel de compra não deixava de ser fixo no celular.
- **Conversa sem rota própria**: o voltar do Android/navegador saía da tela inteira. Agora é `/conversas/:id`.
- Formulários de duas colunas não se adaptavam ao celular.
- Servidor: login quebrava (erro 500) sem `JWT_SECRET` no ambiente local.
- Servidor: sem `trust proxy`, todos os usuários no Render dividiam o mesmo limite de requisições.
- Servidor: CORS aceitava só uma origem e bloquearia os apps nativos.
- Servidor: Amex exigia CVV de 3 dígitos; Elo e Hipercard eram detectados errado.
- Servidor: limite de login contava também os acessos bem-sucedidos.
- Servidor: valores nos avisos saíam como "R$ 70224.00".

### Arquitetura
- Nova organização do frontend (`app/`, `components/ui|layout|domain`, `config/`, `lib/`, `hooks/`, `styles/`).
- Navegação com fonte única (`config/navigation.js`), substituindo dois menus duplicados.
- Telas carregadas sob demanda; o pacote inicial caiu de 719 KB para ~220 KB (React + app).
- Cliente da API com tempo limite, mensagens de "sem internet" e logout automático quando a sessão expira.
- Login devolve a pessoa à página que ela tentava abrir.
- Design system com tokens CSS e componentes reutilizáveis, no lugar de estilos embutidos.

### Navegação e layout
- Celular: barra superior com áreas seguras e voltar nas telas internas + abas inferiores.
- Tablet: trilho de navegação. Desktop: barra lateral com usuário e Sair.
- Diálogos como folha inferior no celular e janela central no tablet/desktop.
- `confirm()`/`prompt()` do navegador substituídos por diálogos do app; avisos de sucesso viraram toasts.

### Padrões Apple e Google
- Contraste AA, toques de 44 pt, rótulos acessíveis, foco visível, movimento reduzido.
- Exclusão de conta dentro do app; sair com confirmação; aceite de termos no cadastro.
- Páginas de Política de privacidade e Termos de uso (modelos para revisão jurídica).
- PWA instalável (manifesto, ícones, service worker sem cache de dados financeiros).
- Fontes embutidas (sem Google Fonts).
- Projetos iOS e Android (Capacitor) com ícones, splash, permissões e manifesto de privacidade.
- Guia de publicação em `docs/LOJAS.md`.
