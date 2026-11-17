# Histórico acumulado no ranking de AC4

Fonte: tabela de agosto, setembro e outubro/2026 enviada pelo usuário em 16/11/2026. Os 27 RGs foram conferidos no cadastro validado. O usuário confirmou que os campos em branco representam **R$ 0,00** e que a linha de OSVALDIR, identificada como RG 1567 na imagem, deve ser vinculada ao **RG 1657**. A imagem, nomes completos, CPFs e contatos não são incluídos no cadastro público desta funcionalidade.

| Mês | Militares | Total informado |
|---|---:|---:|
| Agosto/2026 | 27 | R$ 49.055,00 |
| Setembro/2026 | 27 | R$ 59.948,00 |
| Outubro/2026 | 27 | R$ 68.283,00 |

O seletor **Período histórico (em meses) de AC4 acumulado no ranking**, de 0 a 4, usa como referência o mês exibido no calendário. O padrão é 0; a escolha permanece durante a sessão, inclusive ao navegar entre meses, e volta a 0 ao recarregar.

- **0:** somente os AC4 entre Início e Fim no mês selecionado.
- **1:** o período selecionado mais o mês anterior inteiro.
- **2, 3 ou 4:** o período selecionado mais os respectivos meses anteriores inteiros.

Em novembro, as opções 1, 2 e 3 incluem outubro, setembro e agosto, sucessivamente. A opção 4 também solicita julho, que não foi informado: seus valores ficam fora da soma e os totais são identificados como **parciais**. A ausência de informação não equivale ao zero explicitamente confirmado na tabela. O mesmo tratamento vale para oficiais ou reforços que não constam dos consolidados.

A coluna **AC4 HISTÓRICO** aparece ao selecionar um ou mais meses. **AC4 OPERACIONAL** e **AC4 SAT** continuam mostrando somente os serviços do intervalo do mês exibido; **AC4 TOTAL** soma essas duas colunas ao histórico. O histórico da imagem não possui divisão Operacional/SAT nem identificação dos serviços, horários ou execução, e essas informações não são presumidas. O detalhamento de cada militar mostra os meses, valores, origem e eventuais lacunas, seguido dos serviços individuais do mês selecionado.

Quando um mês anterior possui escala no calendário, são usados os seus AC4 cadastrados válidos, previstos ou com execução confirmada, pelo início do serviço. Revisões canônicas, cancelamentos e continuidade da SAT seguem o mesmo cálculo financeiro. Reforços virtuais da simulação são excluídos. Havendo consolidado para o mesmo RG/mês, ele substitui os registros individuais nessa soma, evitando duplicação.

A ordenação por total considera o valor acumulado; os filtros de oficiais e antiguidade continuam funcionando. Um militar com AC4 somente em meses anteriores cadastrados também pode aparecer, sem antiguidade inventada. Os totais históricos não alteram a escala, a cota mensal, o planejamento financeiro, a simulação ou os documentos ES/OS.

Os dados públicos ficam em `ac4-ranking-history-data`, com competência, RG e valor inteiro em centavos. O cálculo é isolado em `AC4RankingHistory`; `AC4Finance.ranking` preserva seu comportamento original. A validação inclui as oito regras em `tests/ranking-history.test.cjs`, o fluxo em `tests/ranking-history.browser.cjs` e a suíte de regressão existente.
