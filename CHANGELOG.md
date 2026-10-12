# Registro de mudanças

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
