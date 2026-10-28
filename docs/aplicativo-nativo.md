# Aplicativo de gerenciamento — preparação inicial

Capacitor reaproveita o painel da loja. No aplicativo, a entrada abre `/admin`; a validação de administrador existente continua obrigatória. No navegador, a loja continua igual.

## Ícone e tela de abertura

O projeto já inclui `assets/icon.png`, `assets/splash.png` e `assets/splash-dark.png` gerados a partir da logo da loja. Para aplicar no Android/iPhone, execute **uma vez**, depois de `npx cap add android` (e/ou `ios`):

```
npm run cap:assets
npx cap sync
```

Repita `npm run cap:assets` + `npx cap sync` se trocar a logo ou as telas.

## Importante: abrir o aplicativo, não o atalho do navegador

- O aplicativo nativo abre em **tela cheia, sem barra de endereço**. Se aparecer uma barra de endereço em cima (por exemplo `...lovableproject.com`), você está no **Chrome**, não no aplicativo.
- Procure o ícone da loja na lista de aplicativos do celular (nome *scardtopia*). Atalhos antigos criados pelo Chrome ("Adicionar à tela inicial") abrem o navegador — remova-os se houver confusão.
- O login Google abre o navegador do celular por segurança; isso é esperado. O retorno automático ao aplicativo ainda precisa ser validado no aparelho.

## Testar no computador e celular

1. Use **Export to GitHub** no Lovable para conectar o projeto ao seu repositório.
2. Baixe o projeto. Se já o tem no computador, primeiro execute `git pull`.
3. Execute `npm install`.
4. Adicione as plataformas desejadas: `npx cap add android` e/ou `npx cap add ios` (uma vez).
5. Execute `npx cap update android` e/ou `npx cap update ios`.
6. Execute `npm run cap:assets` (ícone e tela de abertura).
7. Execute `npm run build`.
8. Execute `npx cap sync`.
9. Execute `npx cap run android` ou `npx cap run ios`.

Android exige Android Studio e seu SDK. iPhone exige um Mac com Xcode. Após cada atualização, faça `git pull`, instale as dependências, gere o site e execute `npx cap sync` antes de testar novamente.

## Estado atual e limites

- O aplicativo carrega as telas incluídas na instalação, sem depender do endereço temporário da prévia. Os dados da loja e o login continuam exigindo internet. Alterações nas telas exigem gerar e sincronizar novamente o aplicativo.
- Ícone e tela de abertura da loja estão preparados; ainda não foram gerados APK/AAB/IPA assinados nem validado o login no aparelho.
- As telas e notificações internas existentes são reaproveitadas. Não foram adicionadas notificações com o aplicativo fechado, acesso nativo à câmera ou funcionamento sem internet.
- O login Google existente precisa ser testado em aparelho. Antes da distribuição, implementar e validar abertura no navegador do sistema e retorno seguro ao aplicativo, caso necessário; não executar OAuth dentro de um navegador incorporado nem enfraquecer permissões.

## Antes de publicar nas lojas

Gerar os arquivos locais e sincronizar, mantendo a configuração sem bloco `server`. Preparar assinatura, política de privacidade, contas de desenvolvedor e testar login, salvar produtos, pedidos, cupons e comprovantes no aparelho. Publicar o site não publica o aplicativo nas lojas.

Leitura complementar: [história da comunidade Lovable com Capacitor](https://lovable.dev/blog/supercharge-lovable-chrome-extension) e [documentação Capacitor](https://capacitorjs.com/docs/getting-started).
