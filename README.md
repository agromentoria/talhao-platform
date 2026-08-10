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
- Compra de cotas roda dentro de uma transação de banco de dados, evitando
  overselling em compras simultâneas.
- Limite de tentativas de login (proteção contra força bruta) e limite geral
  de requisições por IP.
- Cabeçalhos de segurança HTTP (Helmet) e CORS restrito ao domínio do site.

**Antes de publicar, você ainda precisa:**
1. Trocar os valores em `server/.env` (veja abaixo) por segredos reais.
2. Colocar HTTPS na frente da API (qualquer provedor moderno já entrega isso).
3. Trocar a senha do administrador padrão no primeiro login.
4. Se for movimentar dinheiro de verdade, integrar um gateway de pagamento
   (Pix/cartão) para o passo de "comprar cotas" — hoje o valor é registrado
   no sistema, mas a cobrança real ainda não está conectada a nenhum meio de
   pagamento. Recomendo Pix via um provedor como Mercado Pago, Pagar.me ou
   Stripe, e um fluxo equivalente para o repasse às fazendas e investidores.

## Estrutura do projeto

```
talhao-platform/
├── server/     API (Node.js + Express + SQLite)
└── client/     Interface web (React + Vite)
```

## Rodando localmente

### 1. Backend

```bash
cd server
cp .env.example .env      # depois edite o .env com seus valores
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
npm run dev
```

A interface sobe em `http://localhost:5173` e já conversa com a API local.

## Publicando de verdade

### Backend
Qualquer serviço que rode Node.js funciona: Railway, Render, Fly.io, ou um
VPS comum. Passos gerais:
1. Suba a pasta `server/` para o serviço escolhido.
2. Configure as variáveis de ambiente do `.env.example` no painel do
   serviço (nunca envie o `.env` real para um repositório público).
3. Rode `npm install` e `npm start` (a maioria dos serviços faz isso
   automaticamente).
4. Anote a URL pública da API, por exemplo `https://api.meutalhao.com.br`.

O banco de dados é um arquivo SQLite (`data/talhao.db`) — simples de
começar. Se o volume de uso crescer bastante, é possível migrar para
PostgreSQL trocando apenas o arquivo `server/src/db.js`.

### Frontend
1. Defina a variável `VITE_API_URL` apontando para a URL pública da API
   (ex: `https://api.meutalhao.com.br/api`).
2. Rode `npm run build` dentro de `client/` — isso gera a pasta `dist/`
   com arquivos estáticos prontos.
3. Publique essa pasta em qualquer hospedagem de site estático: Netlify,
   Vercel, Cloudflare Pages, ou o próprio servidor onde está o Joomla.

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

- Logos em `client/public/` (`logo-horizontal.svg` no cabeçalho,
  `logo-icon.svg` nas telas de login/cadastro e como favicon).
- Paleta de cores real em `client/src/theme.js`, extraída de
  `paleta_de_Cores_meutalhao.svg`: verde (#668C2D / #445F1C), dourado
  (#F9B000 / #DD8209), creme de fundo (#EADFCD) e marrom para texto
  (#3A2E22 / #6A5B4C).

Se a marca for atualizada no futuro, troque os arquivos SVG em
`client/public/` e os valores em `theme.js` — nenhuma outra parte do
sistema precisa mudar.

## Próximos passos sugeridos

- Upload de fotos do talhão/fazenda.
- Notificações por e-mail (fazenda publica talhão, safra muda de fase,
  colheita é paga).
- Integração de pagamento real (Pix/cartão) para compra de cotas e repasse
  às fazendas/investidores.
- Histórico de documentos e contratos por talhão.
