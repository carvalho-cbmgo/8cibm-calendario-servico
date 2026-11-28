# Virada de mês e retificações de 25/11/2026

Solicitação do usuário em 25/11/2026: exibir o rateio de AC4 nos dias que participam da virada de competência, vincular todos os AC4 de 25/11 à OS nº 388 (SEI 98752637) e retificar três períodos existentes.

| Militar | Início | Término | Horas | Valor | OS nº / SEI |
|---|---|---|---:|---:|---|
| SD HUGO | 25/11/2026 08h00 | 26/11/2026 08h00 | 24h | R$ 741,00 | 388 / 98752637 |
| 1º SGT HELLYSSON | 26/11/2026 08h00 | 26/11/2026 17h00 | 9h | R$ 270,00 | 393 / 98894389 |
| SD CAVALCANTE | 26/11/2026 08h00 | 26/11/2026 20h00 | 12h | R$ 360,00 | 393 / 98894389 |
| ST DA SILVA | 27/11/2026 08h00 | 27/11/2026 20h00 | 12h | R$ 480,00 | 394 / 98894413 |

Os quatro AC4 de 25/11 — DIEGO, HUGO, BERTONCELLO e ROBERTO — usam a OS nº 388/SEI 98752637, totalizando 57h/R$ 1.752,00. A OS nº 388/SEI 98727025 de SANTOS em 23/11 permanece preservada. Na SAT de 23–30/11, os dois registros de 25/11 passam para a OS 388; os outros treze continuam na OS 379. Períodos e valores da SAT não foram alterados.

As alterações acrescentam R$ 381,00 para HUGO, R$ 360,00 para CAVALCANTE e R$ 30,00 para HELLYSSON e retiram R$ 515,00 de DA SILVA: aumento líquido de R$ 256,00. Novembro tem 108 serviços, com R$ 45.830,00 comprometidos, R$ 37.000,00 operacionais, R$ 8.830,00 SAT e saldo planejado de **R$ 10,00** sobre a cota de R$ 45.840,00. A execução confirmada permanece em R$ 10.966,00; os serviços retificados seguem previstos. Dezembro conserva R$ 7.641,00 comprometidos e R$ 30.359,00 de saldo sobre a cota de R$ 38.000,00.

Os dias 25, 26 e 27 mantêm seis recursos contínuos de 24h. A simulação de meta seis continua sem reforços adicionais em novembro. ST TAVARES está expressamente designado como ACA das 24h de 27/11, das 08h às 08h do dia seguinte; DA SILVA permanece somente no AC4 diurno de 12h. Todas as escalas de 01–30/11 estão confirmadas. As cinco novas confirmações de 26–30 foram registradas em 25/11/2026, com escopo de calendário; o histórico de 01–25, os estados de execução dos AC4, os afastamentos, trocas, cotas e tarifas foram preservados.

## Apresentação da virada

`AC4Finance.monthTurn` usa os registros canônicos e o rateio financeiro já existente. A área **Virada de mês** aparece somente no último e no primeiro dia de meses envolvidos em serviços com horas nas duas competências. Cada serviço mostra militar, modalidade/atividade, OS/SEI, jornada integral e as duas parcelas, com horas, intervalos e valores. A cota do mês exibido recebe destaque; um total resume somente os serviços da virada nessa cota.

No cadastro atual, CAVALCANTE aparece em 30/11 e 01/12: 16h/R$ 486,00 de novembro e 8h/R$ 255,00 de dezembro, conservando o serviço de 24h/R$ 741,00. Múltiplos serviços ficam individualizados. Revisões e continuidade são resolvidas antes da apresentação; cancelados, inválidos e reforços simulados não entram no quadro. Término exatamente à meia-noite não cria parcela vazia. Os limites mensais, inclusive fevereiro bissexto e dezembro/janeiro, são determinados pelas datas dos serviços.

O quadro fica no rodapé financeiro do cartão, preservando o alinhamento das listas no computador. Cartões com o marcador HOJE usam fluxo vertical para que o marcador não desloque os controles das seções. No celular, os valores ficam ao lado de cada competência e os intervalos podem quebrar linha.

`tests/virada-mes-25nov.test.cjs` confere períodos/valores/documentos, saldos, cortes do ranking, rateio em ambos os dias, vários serviços, revisões, cancelamentos, simulação, meia-noite, ano bissexto e virada de ano. O teste reconstrói exatamente o calendário anterior, SHA-256 `e999de8cb3db818659497ad899c2d1a8a59edda64a38edcb173bbd00fefaf46f`, revertendo somente as alterações autorizadas e suas coberturas derivadas. As expectativas financeiras e fotografias de integridade anteriores foram atualizadas para esses dados. O roteiro de navegador confere os controles, cópia SEI, ES/OS, ranking, exclusões e apresentação em computador e celular com toque de 320/390px, sem enviar mensagens nem salvar cadastros privados.
