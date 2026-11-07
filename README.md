# Calendário de Serviço — 8ª CIBM

Calendário HTML responsivo e estático para exibição da previsão de militares por ala, dos serviços SAT e do controle financeiro de AC4. Há dados de novembro/2026 a janeiro/2027; meses sem dados mostram essa condição.

O ícone de troféu, à esquerda do detalhamento da cota, abre o ranking mensal por AC4 Total (Operacional + SAT). O ranking considera os registros até a data de acesso em Brasília e permite incluir ou excluir o serviço do dia corrente. Os previstos são identificados separadamente da execução confirmada; não há presunção de pagamento. Ao clicar no militar, são listados os serviços ativos do mês, sinalizando os que ficaram fora da data de corte. As identificações completas utilizam o mesmo cadastro local do módulo ES/OS, importável também pela janela do ranking.

Os 27 praças do Plano de Chamada aparecem mesmo sem AC4. Os checkboxes permitem incluir os 3 oficiais e ordenar por antiguidade; nessa ordenação, ORDEM mostra a numeração original do plano. Reforços fora da relação, como FERREIRA, aparecem quando há AC4 até o corte, com antiguidade pendente quando não informada. O cadastro público do ranking contém somente identificação abreviada, antiguidade e indicação de oficial.

## Hospedagem via GitHub Pages

1. A publicação atual acompanha a branch `v-1`, pasta **/(root)**, em **Settings → Pages → Build and deployment → Deploy from a branch**.
2. Mantenha `v-1` sincronizada com as alterações revisadas em `main`. Um push para a branch configurada inicia a publicação.
3. Confira o resultado final da execução **pages build and deployment**, em **Actions**. **Queued** significa aguardando execução; **Success** confirma que a publicação terminou.
4. Se o artefato for aceito e a implantação terminar com **Deployment failed, try again later**, reexecute o job de publicação em **Re-run jobs → Re-run failed jobs**. Esse erro ocorre depois da construção e precisa ser acompanhado no Pages.

## Verificação local

Execute `node --test tests/finance.test.cjs` para conferir tarifas, viradas de dia/mês, revisões, cancelamentos, acumulados, identificação dos documentos e seleção de chefia. Os testes utilizam dados fictícios separados da escala publicada e conferem invariantes dos dados existentes.

Para abrir o site localmente, execute `python -m http.server 8000` na raiz do repositório e acesse `http://localhost:8000/`. O cadastro de identificação para ES/OS é importado apenas no navegador; arquivos de cadastro e documentos internos devem permanecer fora do repositório.

**Privacidade:** repositórios públicos e GitHub Pages públicos tornam a escala acessível a qualquer pessoa. Obter autorização institucional antes da divulgação. O calendário não substitui documentos oficiais e possui registros pendentes de conferência.
