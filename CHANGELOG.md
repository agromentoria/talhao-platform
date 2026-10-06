# Registro de mudanças

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
