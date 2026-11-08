# Calendário de Serviço — 8ª CIBM

Calendário HTML responsivo e estático para exibição da previsão de militares por ala, dos serviços SAT e do controle financeiro de AC4. Há dados de novembro/2026 a janeiro/2027; meses sem dados mostram essa condição.

O cabeçalho diário apresenta a cobertura registrada em recursos de 24h, a quantidade de militares em serviço ordinário operacional (incluindo TS e TS CIA de pagamento, excluindo dispensas e trocas pendentes) e a quantidade de AC4 ativos do Operacional, incluindo PROEBOM e jornadas parciais. A SAT permanece separada. As duas contagens de serviços não equivalem necessariamente à cobertura de 24h.

No computador com mouse, o cartão sob o ponteiro recebe um fundo suave para acompanhar a leitura: azul nas previsões e verde nas escalas confirmadas. As cores dos badges e valores são mantidas. O destaque não se aplica ao celular ou à impressão, e respeita a preferência por movimento reduzido.

Os botões à esquerda de OPERACIONAL e SEÇÃO ATIVIDADES TÉCNICAS expandem ou recolhem a lista e os botões de detalhes e documentos. As duas áreas começam fechadas. No celular, a escolha de cada área acompanha a navegação entre dias, filtros e meses durante a sessão. No computador, cada dia mantém sua própria escolha. As preferências de celular e computador são independentes ao redimensionar a tela. Um novo carregamento começa com as duas áreas recolhidas; a impressão apresenta o conteúdo das duas áreas. O cabeçalho móvel mantém os textos e alvos de toque com menos espaço entre o mês e CONTROLE AC4.

Trocas parciais mantêm os dois militares no dia com horários complementares e carga horária ordinária explícita. A TS vinculada ao período é uma anotação documental, sem duplicar horas na seleção de chefia. Na ES, ambos os militares apresentam a referência da TS na primeira linha das observações, seguida do período ordinário que cada um trabalhará; o substituto também apresenta a identificação do militar substituído. A função de chefia é exibida como CHEFE DE ALA. A TS 168 contempla 08 e 29/11, sem alterar a quantidade de recursos de 24h ou os valores de AC4.

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
