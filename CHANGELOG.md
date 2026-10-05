# Registro de mudanças

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
