# Talhão — plataforma de investimento em commodities agrícolas

Projeto completo, pronto para publicar: backend (API + banco de dados) e
frontend (interface web) separados do Joomla, para rodar como um produto
próprio ao lado do site institucional.

## O que já está pronto

- **Cadastro e login** com 3 tipos de conta: **administrador** (mediador da
  plataforma), **fazenda** e **investidor**.
- **Fazendas** se cadastram, ficam em análise ("pendente") até o administrador
  aprovar, e depois de aprovadas podem publicar talhões e definir sua própria
  comissão sobre o lucro da colheita.
- **Talhões (commodities)** com fase da safra (preparo, plantio, crescimento,
  colheita), progresso, valor da cota e cotas disponíveis.
- **Investidores** compram cotas com segurança contra concorrência (duas
  pessoas não conseguem comprar a mesma cota ao mesmo tempo), acompanham a
  safra e recebem sua parte líquida quando a fazenda finaliza a colheita.
- **Comissões transparentes**: cada fazenda define a sua, e a plataforma
  aplica a comissão do Talhão automaticamente sobre o lucro — nunca sobre o
  valor investido.
- **Painel do administrador**: visão geral (total captado, comissão
  acumulada, fazendas, investidores) e aprovação/suspensão de fazendas.

## Segurança já implementada

- Senhas nunca ficam em texto puro (hash com bcrypt).
- Login por token (JWT) com expiração.
- Cada rota da API confere o papel do usuário (`admin`, `fazenda`,
  `investidor`) antes de permitir a ação — um investidor não consegue, por
  exemplo, atualizar a safra de um talhão, e uma fazenda não mexe nos dados
  de outra.
- Compra de cotas roda dentro de uma transação com trava de linha
  (`SELECT ... FOR UPDATE`) no banco de dados, testado com compras
  simultâneas reais para garantir que nunca vende mais cotas do que existe.
- Limite de tentativas de login (proteção contra força bruta) e limite geral
  de requisições por IP.
- Cabeçalhos de segurança HTTP (Helmet) e CORS restrito ao domínio do site.
- O servidor **se recusa a iniciar em produção** se `JWT_SECRET` ou
  `ADMIN_PASSWORD` não forem configurados com valores reais.

**Antes de publicar, você ainda precisa:**
1. Criar um banco Postgres gratuito (veja "Banco de dados" abaixo) e colocar
   a string de conexão em `server/.env`.
2. Trocar os demais valores em `server/.env` por segredos reais.
3. Colocar HTTPS na frente da API (qualquer provedor moderno já entrega isso).
4. Trocar a senha do administrador padrão no primeiro login.
5. Se for movimentar dinheiro de verdade, integrar um gateway de pagamento
   (Pix/cartão) para o passo de "comprar cotas" — hoje o valor é registrado
   no sistema, mas a cobrança real ainda não está conectada a nenhum meio de
   pagamento. Recomendo Pix via um provedor como Mercado Pago, Pagar.me ou
   Stripe, e um fluxo equivalente para o repasse às fazendas e investidores.

## Banco de dados

A API usa **Postgres**. Para não precisar de cartão de crédito internacional
nem servidor próprio, recomendamos o [Neon](https://neon.tech): banco
Postgres gratuito de verdade (não é teste por tempo limitado), sem pedir
cartão, com armazenamento suficiente para começar.

1. Crie uma conta em https://neon.tech (dá pra entrar com GitHub).
2. Crie um projeto — o Neon já cria um banco chamado `neondb`.
3. Copie a "Connection string" que ele mostra (algo como
   `postgresql://usuario:senha@ep-exemplo.sa-east-1.aws.neon.tech/neondb?sslmode=require`).
4. Cole esse valor em `DATABASE_URL` no seu `.env` (local) ou nas variáveis
   de ambiente do serviço de hospedagem (produção).

Na primeira vez que o servidor rodar, ele cria todas as tabelas
automaticamente — não precisa rodar nenhum script de migração à parte.



## Estrutura do projeto

```
talhao-platform/
├── server/                 API (Node.js + Express + Postgres)
│   └── src/
│       ├── routes/         uma rota por assunto (auth, plots, farms, investments…)
│       ├── middleware/     autenticação e tratamento de erros
│       ├── db.js           esquema do banco (criado/atualizado ao iniciar)
│       └── format.js       formatação de valores em R$ para os avisos
├── client/                 Interface (React + Vite) — web, PWA, iOS e Android
│   ├── src/
│   │   ├── app/            App, rotas (carregadas sob demanda) e guardas de acesso
│   │   ├── components/
│   │   │   ├── ui/         Button, campos, chips, abas, Dialog, Toast, Banner…
│   │   │   ├── layout/     AppShell (abas/trilho/barra lateral), Page, PageHeader
│   │   │   └── domain/     PlotCard, PhotoGallery, ShareButton, CityStateSelect
│   │   ├── config/         theme.js (constantes) e navigation.js (menus por perfil)
│   │   ├── context/        sessão do usuário (AuthContext)
│   │   ├── lib/            api, storage, format, validators, files, native, pwa
│   │   ├── pages/          uma tela por arquivo (+ legal/ privacidade e termos)
│   │   └── styles/         tokens.css, base.css, layout.css, components.css
│   ├── public/app-icons/   ícones PNG (PWA, Apple, lojas) e splash
│   ├── ios/  android/      projetos nativos (Capacitor)
│   └── capacitor.config.json
└── docs/LOJAS.md           guia de publicação na App Store e no Google Play
```

### Design system

Cores, tipografia, espaçamentos, raios e medidas de navegação ficam em
`client/src/styles/tokens.css`. As cores de ação foram ajustadas para contraste
AA (texto branco sobre laranja `#B26000` e verde `#557A22`); as cores originais da
marca continuam nas ilustrações e destaques. Para uma tela nova, use `Page` +
`PageHeader` e os componentes de `components/ui` — evite estilos embutidos.

### Navegação por tamanho de tela

| Janela | Largura | Navegação |
|---|---|---|
| Celular | < 600 px | barra superior (com voltar nas telas internas) + abas inferiores (máx. 5) |
| Tablet | 600–1199 px | trilho lateral com ícones |
| Desktop | ≥ 1200 px | barra lateral com usuário e botão Sair |

Os itens de menu de cada perfil estão num único lugar: `client/src/config/navigation.js`.

## Rodando localmente

### 1. Backend

```bash
cd server
cp .env.example .env      # depois edite o .env com sua DATABASE_URL e demais valores
npm install
npm run seed               # opcional: cria 2 fazendas e 4 talhões de exemplo
npm start
```

A API sobe em `http://localhost:4000`. Um usuário administrador é criado
automaticamente na primeira execução, com o e-mail e senha definidos no
`.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

### 2. Frontend

```bash
cd client
npm install
npm run dev        # interface em http://localhost:5173
npm run lint       # verificação do código
npm run build      # versão de produção (gera também o PWA)
```

Apps nativos: veja `docs/LOJAS.md` (`npm run cap:ios` / `npm run cap:android`).

A interface sobe em `http://localhost:5173` e já conversa com a API local.

## Publicando de verdade (sem cartão de crédito internacional)

### Backend — Render (plano gratuito) + Neon (banco gratuito)

1. Crie o banco no Neon como descrito acima e guarde a `DATABASE_URL`.
2. Crie uma conta em https://render.com com **Sign up with GitHub** (não
   pede cartão para o plano gratuito).
3. **New +** → **Web Service** → selecione o repositório
   `agromentoria/talhao-platform`.
4. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Em **Environment Variables**, adicione todas as chaves do
   `server/.env.example`, com valores reais — principalmente
   `DATABASE_URL` (do Neon), `JWT_SECRET` (gere em
   https://generate-secret.vercel.app/32), `ADMIN_EMAIL` e
   `ADMIN_PASSWORD`. Configure também `NODE_ENV=production`.
6. Crie o serviço. O Render te dá uma URL pública, tipo
   `https://talhao-api.onrender.com`.

**Sobre o plano gratuito:** o serviço "dorme" depois de alguns minutos sem
uso e demora ~1 minuto para acordar na próxima visita — normal para começar
sem custo. Como o banco de dados agora mora no Neon (não no disco do
Render), os dados nunca se perdem, mesmo com o serviço dormindo e
acordando. Quando o volume de uso justificar, basta trocar o plano do
Render para "Starter" (elimina esse soneca) sem mexer em nada do código.

### Frontend — Netlify (plano gratuito)

1. Crie uma conta em https://netlify.com com **Sign up with GitHub**.
2. **Add new site** → **Import an existing project** → escolha o
   repositório `agromentoria/talhao-platform`.
3. Configure:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`
4. Em **Environment variables**, adicione `VITE_API_URL` com o valor
   `https://talhao-api.onrender.com/api` (troque pela URL real do Render).
5. **Deploy site** — você recebe uma URL tipo
   `https://talhao-platform.netlify.app`.
6. Volte no Render e defina `CLIENT_ORIGIN` com essa URL do Netlify, para
   liberar o CORS entre os dois (aceita vários endereços separados por vírgula).
7. Como o app usa rotas próprias (`/talhao/12`, `/perfil`…), crie o arquivo
   `client/public/_redirects` com `/*  /index.html  200` — já incluído no projeto.

## Integrando com o site atual em Joomla

Como conversamos, o caminho mais sustentável é manter o Joomla como site
institucional e publicar o Talhão como aplicação própria, por exemplo em
`app.purodafazenda.com` ou `purodafazenda.com/talhao`. No Joomla, basta
criar um item de menu ou botão apontando para esse endereço (ou embutir em
um iframe, se preferir manter tudo na mesma URL). Se no futuro quiser
login único entre o site e o app, dá para integrar depois — não é
bloqueante para publicar agora.

## Identidade visual

Já aplicada a identidade oficial do Meu Talhão:

- Logos em `client/public/` (`logo-header.svg` nas barras de navegação,
  `logo-icon.svg` no login/cadastro, trilho do tablet e ícones do app).
- Paleta em `client/src/styles/tokens.css` (interface) e
  `client/src/config/theme.js` (gráficos e ícones).
- Fontes Baloo 2 e Inter embutidas no app (`@fontsource`), sem Google Fonts.

Se a marca mudar, troque os SVGs em `client/public/`, regenere os PNGs de
`client/public/app-icons/` e ajuste `tokens.css`.

## Repositório no GitHub

O código já está publicado em
**https://github.com/agromentoria/talhao-platform**, branch `main`.

Para trazer atualizações futuras deste projeto para o seu computador, ou
enviar novas mudanças, use o GitHub Desktop (interface visual, sem
terminal) ou os comandos `git pull` / `git add` / `git commit` / `git push`
de dentro da pasta `talhao-platform/`.

## Próximos passos sugeridos

- Notificações por e-mail e push (fazenda publica talhão, safra muda de fase,
  colheita é paga).
- Integração de pagamento real (Pix/cartão) para compra de cotas e repasse
  às fazendas/investidores.
- Histórico de documentos e contratos por talhão.
