# Publicação na App Store e no Google Play

O app web é empacotado para iOS e Android com o **Capacitor**: o mesmo código
React roda dentro de um app nativo. Os projetos nativos já estão em
`client/ios` e `client/android`, com nome, ícones, splash, cores e permissões
configurados.

## 1. Antes de tudo

| Item | Onde | Situação |
|---|---|---|
| API publicada em **HTTPS** | Render / outro | obrigatório: o app nativo não acessa `http://` nem `localhost` |
| `VITE_API_URL` apontando para a API | `client/.env.production` | criar o arquivo antes do build |
| `CLIENT_ORIGIN` com o domínio web | variáveis do servidor | os apps nativos já são liberados automaticamente |
| Política de privacidade e termos revisados pelo jurídico | `client/src/pages/legal/` | **modelo pronto, revisar** |
| URL pública da política (ex.: `https://app.meutalhao.com.br/privacidade`) | formulários das lojas | já existe a rota `/privacidade` |
| Conta Apple Developer (US$ 99/ano) em nome da **empresa** | developer.apple.com | necessário CNPJ e D-U-N-S |
| Conta Google Play Console (US$ 25) em nome da **empresa** | play.google.com/console | |

> **Atenção regulatória.** Apple (diretriz 5.1.1(ix)) e Google (declaração de
> recursos financeiros) exigem que apps de investimento sejam publicados pela
> empresa que presta o serviço e podem pedir comprovação de autorização. No
> Brasil, captação coletiva para empreendimentos é regulada pela CVM
> (Resolução 88). Confirme o enquadramento com o jurídico antes de enviar.

## 2. Gerar os apps

```bash
cd client
echo "VITE_API_URL=https://SUA-API/api" > .env.production
npm install
npm run cap:android   # abre o Android Studio
npm run cap:ios       # abre o Xcode (só no Mac; roda `pod install` sozinho)
```

### iOS (Xcode)
1. Em **Signing & Capabilities**, escolha o time da empresa. Bundle ID: `br.com.meutalhao.app`.
2. Arraste `App/PrivacyInfo.xcprivacy` para o grupo **App** no Xcode (marcar o target *App*).
3. **Product › Archive** e envie pelo Organizer para o App Store Connect.
4. Já configurado: ícone 1024, splash, idioma pt-BR, textos de permissão de câmera e
   fotos (sem eles o app fecha ao escolher uma imagem), `ITSAppUsesNonExemptEncryption = NO`,
   iPhone em retrato e iPad em todas as orientações.

### Android (Android Studio)
1. **Build › Generate Signed Bundle (AAB)** com uma chave de upload nova. Guarde a chave
   e as senhas fora do repositório.
2. Envie o `.aab` no Play Console. Ative o *Play App Signing*.
3. Já configurado: ícone adaptativo (fundo creme), ícone redondo, splash, cores da marca,
   botão voltar do sistema voltando uma tela por vez.

## 3. Formulários das lojas

**App Store Connect › Privacidade do app** e **Play Console › Segurança dos dados**,
declare o que o app coleta (tudo vinculado à identidade, nenhum para rastreamento):
nome, e-mail, telefone, endereço, CPF/CNPJ, dados de recebimento (Pix/banco), últimos
4 dígitos do cartão, fotos enviadas, mensagens trocadas no app. Dados criptografados
em trânsito: **sim**. O usuário pode pedir exclusão: **sim, dentro do app**.

**Exclusão de conta:** Perfil › Mais › Excluir conta. Para o Google, informe também
uma URL web de exclusão: a mesma tela funciona no navegador em `/perfil?aba=mais`.

**Conta de teste para a revisão:** crie um investidor e uma fazenda aprovada com
talhões publicados e informe e-mail/senha nas notas de revisão. A Apple reprova apps
de login sem conta de demonstração.

**Classificação:** finanças. Sem anúncios, sem compras dentro do app (o pagamento de
investimentos não passa pelo sistema da Apple/Google, o que é permitido para bens e
serviços financeiros reais).

## 4. Checklist de diretrizes já atendidas no código

- Navegação: barra de abas com até 5 itens no celular, trilho no tablet, barra lateral no desktop.
- Áreas seguras (notch, Dynamic Island, barra de gestos) respeitadas em todas as barras.
- Alvos de toque de no mínimo 44 pt / 48 dp.
- Contraste de texto AA (4,5:1) nas cores de ação e texto secundário.
- Campos com 16 px no celular (sem zoom automático do iOS), teclados corretos
  (`inputMode`) e preenchimento automático (`autocomplete`) para senha, e-mail, endereço e cartão.
- Rótulos acessíveis em todos os botões de ícone (VoiceOver/TalkBack), foco visível
  para teclado, diálogos com foco preso e fechamento por Esc/voltar.
- Movimento reduzido respeitado (`prefers-reduced-motion`).
- Exclusão de conta dentro do app; sair da conta com confirmação.
- Confirmação explícita antes de qualquer pagamento.
- Funciona offline como PWA (só a interface; dados financeiros nunca vão para cache).
- Fontes embutidas, sem chamadas a terceiros (Google Fonts removido).

## 5. Pendências fora do código

- Integrar gateway real de pagamento (Pix/cartão) e repasses: hoje as compras são registradas, não cobradas.
- Universal Links (iOS) e App Links (Android) para abrir links compartilhados direto no app:
  publicar `/.well-known/apple-app-site-association` e `/.well-known/assetlinks.json` no domínio web.
- Capturas de tela das lojas: iPhone 6,9", iPad 13" e celular Android.
