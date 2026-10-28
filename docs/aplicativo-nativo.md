# Aplicativo de gerenciamento — preparação inicial

Capacitor reaproveita o painel da loja. No aplicativo, a entrada abre `/admin`; a validação de administrador existente continua obrigatória. No navegador, a loja continua igual.

## Testar no computador e celular

1. Use **Export to GitHub** no Lovable para conectar o projeto ao seu repositório.
2. Baixe o projeto. Se já o tem no computador, primeiro execute `git pull`.
3. Execute `npm install`.
4. Adicione as plataformas desejadas: `npx cap add android` e/ou `npx cap add ios` (uma vez).
5. Execute `npx cap update android` e/ou `npx cap update ios`.
6. Execute `npm run build`.
7. Execute `npx cap sync`.
8. Execute `npx cap run android` ou `npx cap run ios`.

Android exige Android Studio e seu SDK. iPhone exige um Mac com Xcode. Após cada atualização, faça `git pull`, instale as dependências, gere o site e execute `npx cap sync` antes de testar novamente.

## Estado atual e limites

- O aplicativo carrega as telas incluídas na instalação, sem depender do endereço temporário da prévia. Os dados da loja e o login continuam exigindo internet. Alterações nas telas exigem gerar e sincronizar novamente o aplicativo.
- Ainda não foram gerados APK/AAB/IPA nem projetos de plataforma neste ambiente.
- As telas e notificações internas existentes são reaproveitadas. Não foram adicionadas notificações com o aplicativo fechado, acesso nativo à câmera ou funcionamento sem internet.
- O login Google existente precisa ser testado em aparelho. Antes da distribuição, implementar e validar abertura no navegador do sistema e retorno seguro ao aplicativo, caso necessário; não executar OAuth dentro de um navegador incorporado nem enfraquecer permissões.

## Antes de publicar nas lojas

Gerar os arquivos locais e sincronizar, mantendo a configuração sem bloco `server`. Preparar ícones, assinatura, política de privacidade, contas de desenvolvedor e testar login, salvar produtos, pedidos, cupons e comprovantes no aparelho. Publicar o site não publica o aplicativo nas lojas.

Leitura complementar: [história da comunidade Lovable com Capacitor](https://lovable.dev/blog/supercharge-lovable-chrome-extension) e [documentação Capacitor](https://capacitorjs.com/docs/getting-started).