# AC4 por competência mensal

Regra confirmada pelo usuário em 24/11/2026: cota, saldo, ranking, histórico e horas mensais consideram somente a parcela de cada serviço que ocorreu no mês de referência. O limite é a meia-noite: de 00h00 do primeiro dia até 00h00 do mês seguinte, sem omitir nem duplicar minutos. Um serviço que termina exatamente às 00h00 não gera horas no mês que começa nesse instante.

## Valores do cadastro atual

Valores atualizados em 25/11/2026 após as retificações de HUGO, HELLYSSON e DA SILVA. A área **Virada de mês** dos dias envolvidos apresenta as parcelas abaixo, por militar, com o período e valor completos, a competência atual destacada e o total da virada nessa cota.

O AC4 de SD CAVALCANTE, OS nº 397/SEI 98894435, inicia em 30/11/2026 às 08h00 e termina em 01/12/2026 às 08h00. Seu preço integral continua sendo R$ 741,00 e a jornada continua com 24h.

| Competência | Parcela | Horas | Valor |
|---|---|---:|---:|
| Novembro/2026 | 30/11 08h00 a 01/12 00h00 | 16h | R$ 486,00 |
| Dezembro/2026 | 01/12 00h00 a 01/12 08h00 | 8h | R$ 255,00 |
| Integral | 30/11 08h00 a 01/12 08h00 | 24h | R$ 741,00 |

A noite mantém a tarifa correspondente ao dia em que começou, inclusive após a meia-noite. Cada trecho diurno conserva a tarifa da sua própria data. Os valores dos segmentos já calculados são repartidos com conservação dos centavos; o rateio não recalcula nem amplia o preço integral do serviço.

| Competência | Cota | Comprometido no planejamento | Saldo planejado |
|---|---:|---:|---:|
| Novembro/2026 | R$ 45.840,00 | R$ 45.830,00 | R$ 10,00 |
| Dezembro/2026 | R$ 38.000,00 | R$ 2.247,00 | R$ 35.753,00 |

Esses saldos incluem todos os AC4 cadastrados atribuídos às competências, previstos ou com execução confirmada. Não representam pagamento nem apenas serviços já encerrados. O valor conjunto de novembro e dezembro é R$ 48.077,00. A execução confirmada permanece em R$ 10.966,00 em novembro e zero em dezembro. A divergência de ST DA SILVA em 19/11 não foi alterada: o usuário confirmou manter o cadastro de 12h/08h–20h/R$ 360,00.

## Implementação e apresentação

`AC4Finance.price` preserva o preço e os segmentos da jornada integral. `allocations` reparte esses segmentos por mês; `month.records` reúne somente as parcelas atribuídas à competência, incluindo serviços iniciados em outro mês. Revisões e cancelamentos são resolvidos antes do rateio. `month.serviceRecords` e `byEvent` conservam os registros integrais usados na consulta e nos documentos ES/OS. Nenhum serviço, cota ou cadastro é regravado por essa projeção.

Os controles mensais, saldos diários e contabilização semanal usam as parcelas. O detalhamento da cota identifica o militar, a parcela debitada e o serviço completo. O ranking lista somente os registros considerados; quando há rateio, informa também a jornada integral para permitir a conferência. O histórico usa os meses completos já rateados, mantendo a preferência por consolidados fornecidos para o mesmo RG/mês. A soma do histórico com o mês seguinte recompõe o preço do serviço sem duplicação.

Dentro do mês, a data inicial da parcela continua sendo a referência dos seletores Início/Fim. A parcela recebida do mês anterior começa no primeiro dia do novo mês. Quando Fim é a data da consulta em Brasília, a lista e a soma exigem término até o instante consultado. Com qualquer outra data Fim, entram todos os registros do intervalo, inclusive futuros e os que terminam no dia seguinte a Fim. O histórico selecionado permanece no Total. A simulação mantém períodos e cobertura; somente o custo atribuído à cota do mês é rateado, e seus registros virtuais continuam fora do ranking, histórico, consulta e ES/OS.

`tests/competencia-ac4.test.cjs` e `tests/competencia-ac4.browser.cjs` conferem os saldos reais, tarifas após meia-noite, minutos limites, viradas de mês/ano, três competências, revisões/cancelamentos, consulta integral, ranking/histórico e preservação do cadastro. Os testes de navegador cobrem computador e toque em 320/390px, com fuso do navegador diferente de Brasília. As suítes de ranking conferem a atualização imediata dos detalhes e da imagem compartilhada, além dos cenários de Fim hoje/passado/futuro.
