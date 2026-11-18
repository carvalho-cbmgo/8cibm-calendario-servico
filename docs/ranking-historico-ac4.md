# Histórico acumulado no ranking de AC4

Fonte: tabela de agosto, setembro e outubro/2026 enviada pelo usuário em 16/11/2026. Os 27 RGs foram conferidos no cadastro validado. O usuário confirmou que os campos em branco representam **R$ 0,00** e que a linha de OSVALDIR, identificada como RG 1567 na imagem, deve ser vinculada ao **RG 1657**. A imagem, nomes completos, CPFs e contatos não são incluídos no cadastro público desta funcionalidade.

| Mês | Militares | Total informado |
|---|---:|---:|
| Agosto/2026 | 27 | R$ 49.055,00 |
| Setembro/2026 | 27 | R$ 59.948,00 |
| Outubro/2026 | 27 | R$ 68.283,00 |

O seletor **Período histórico (em meses) de AC4 acumulado no ranking**, de 0 a 4, usa como referência o mês exibido no calendário. O padrão é **3**; a escolha permanece durante a sessão, inclusive ao navegar entre meses, e volta a **3** ao recarregar.

As opções de **Início** e **Fim** apresentam data, dia da semana e ala do dia no formato **01/11/2026 (DOM) - DELTA**. Os valores internos das datas e os limites inclusivos permanecem preservados. A ala é lida da escala cadastrada; meses sem escala exibem a falta dessa informação. No celular, os seletores ocupam linhas separadas.

- **0:** somente os AC4 entre Início e Fim no mês selecionado.
- **1:** o período selecionado mais o mês anterior inteiro.
- **2, 3 ou 4:** o período selecionado mais os respectivos meses anteriores inteiros.

Em novembro, as opções 1, 2 e 3 incluem outubro, setembro e agosto, sucessivamente. A opção 4 também solicita julho, que não foi informado: seus valores ficam fora da soma e os totais são identificados como **parciais**. A ausência de informação não equivale ao zero explicitamente confirmado na tabela. O mesmo tratamento vale para oficiais ou reforços que não constam dos consolidados.

A coluna **AC4 HISTÓRICO** aparece ao selecionar um ou mais meses. **AC4 OPERACIONAL** e **AC4 SAT** continuam mostrando somente os serviços do intervalo do mês exibido; **AC4 TOTAL** soma essas duas colunas ao histórico. O histórico da imagem não possui divisão Operacional/SAT nem identificação dos serviços, horários ou execução, e essas informações não são presumidas. O detalhamento de cada militar mostra os meses, valores, origem e eventuais lacunas, seguido dos serviços individuais do mês selecionado.

Quando um mês anterior possui escala no calendário, são usados os seus AC4 cadastrados válidos, previstos ou com execução confirmada, pelo início do serviço. Revisões canônicas, cancelamentos e continuidade da SAT seguem o mesmo cálculo financeiro. Reforços virtuais da simulação são excluídos. Havendo consolidado para o mesmo RG/mês, ele substitui os registros individuais nessa soma, evitando duplicação.

A ordenação por total considera o valor acumulado; os filtros de oficiais e antiguidade continuam funcionando. Um militar com AC4 somente em meses anteriores cadastrados também pode aparecer, sem antiguidade inventada. Os totais históricos não alteram a escala, a cota mensal, o planejamento financeiro, a simulação ou os documentos ES/OS.

Os dados públicos ficam em `ac4-ranking-history-data`, com competência, RG e valor inteiro em centavos. O cálculo é isolado em `AC4RankingHistory`; `AC4Finance.ranking` preserva seu comportamento original. A validação inclui as oito regras em `tests/ranking-history.test.cjs`, o fluxo em `tests/ranking-history.browser.cjs` e a suíte de regressão existente.

## Seletor e compartilhamento

O seletor histórico mede 44 × 32 px no computador e mantém 44 × 44 px em telas móveis. Sua borda e o contorno recebem o roxo dos AC4 enquanto houver foco ou seleção ativa, inclusive com mouse e teclado.

**Compartilhar Ranking** gera uma prévia em PNG com somente as colunas **ORDEM** e **MILITAR**, conforme confirmado pelo usuário. A ordem, inclusão de oficiais, intervalo atual, meses históricos e preferência por antiguidade acompanham o ranking exibido. Na ordenação por antiguidade, a coluna ORDEM mantém os números do cadastro e o traço de quem não possui antiguidade informada.

A coluna MILITAR contém apenas a graduação ou patente e o nome de guerra, usando o cadastro validado quando disponível e a identificação abreviada da escala como alternativa. A imagem não captura o HTML do ranking e não inclui nomes completos, RGs, CPFs, contatos ou valores financeiros. O cabeçalho registra o mês, o intervalo e os filtros que definiram a classificação; eventual histórico parcial também é sinalizado. A geração ocorre localmente, sem envio automático.

Na prévia, **Compartilhar imagem** abre o menu nativo de aplicativos do aparelho, onde o usuário pode escolher o WhatsApp quando disponível. O recurso usa [`navigator.share`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share), após verificar o compartilhamento de arquivos com [`navigator.canShare`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare); seu suporte depende do navegador e do aparelho. **Salvar imagem** oferece o PNG para download, inclusive quando o compartilhamento nativo não está disponível, permitindo anexá-lo manualmente no WhatsApp. Cancelar o compartilhamento mantém a prévia e não inicia download.

`tests/ranking-share.test.cjs` valida identificação abreviada, ausência de dados pessoais/valores, ordenação e preservação das fontes. `node tests/ranking-share.browser.cjs` confere PNG real e download, prévia, foco/tamanho, filtros, compartilhamento nativo simulado, cancelamento/falhas, descarte da imagem e telas de computador/celular com toque. Nenhuma mensagem real é enviada durante os testes.
