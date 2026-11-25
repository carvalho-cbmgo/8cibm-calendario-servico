# Virada de mês e retificações de 25/11/2026

Solicitação do usuário em 25/11/2026: exibir o rateio de AC4 nos dias que participam da virada de competência, vincular todos os AC4 de 25/11 à OS nº 388 (SEI 98752637) e retificar três períodos existentes.

| Militar | Início | Término | Horas | Valor | OS nº / SEI |
|---|---|---|---:|---:|---|
| SD HUGO | 25/11/2026 08h00 | 26/11/2026 08h00 | 24h | R$ 741,00 | 388 / 98752637 |
| 1º SGT HELLYSSON | 26/11/2026 08h00 | 26/11/2026 20h00 | 12h | R$ 360,00 | 393 / 98894389 |
| ST DA SILVA | 27/11/2026 08h00 | 28/11/2026 04h00 | 20h | R$ 830,00 | 394 / 98894413 |

Os quatro AC4 de 25/11 — DIEGO, HUGO, BERTONCELLO e ROBERTO — usam a OS nº 388/SEI 98752637, totalizando 57h/R$ 1.752,00. A OS nº 388/SEI 98727025 de SANTOS em 23/11 permanece preservada. Na SAT de 23–30/11, os dois registros de 25/11 passam para a OS 388; os outros treze continuam na OS 379. Períodos e valores da SAT não foram alterados.

As alterações acrescentam R$ 381,00 para HUGO, R$ 120,00 para HELLYSSON e retiram R$ 165,00 de DA SILVA: aumento líquido de R$ 336,00. Novembro mantém 107 serviços, com R$ 45.910,00 comprometidos, R$ 37.080,00 operacionais, R$ 8.830,00 SAT e saldo planejado de **−R$ 70,00** sobre a cota de R$ 45.840,00. A execução confirmada permanece em R$ 10.966,00; os serviços retificados seguem previstos. Dezembro conserva R$ 1.455,00 comprometidos e R$ 36.545,00 de saldo sobre a cota de R$ 38.000,00.

Os dias 25, 26 e 27 mantêm seis recursos contínuos de 24h. A simulação de meta seis continua sem reforços adicionais em novembro. A chefia de 27/11 fica pendente de conferência pela regra existente para jornadas parciais; não foi presumida designação para substituir o período descoberto. A confirmação da escala de 25/11 e os demais afastamentos, trocas, cotas e tarifas permanecem preservados.

## Apresentação da virada

`AC4Finance.monthTurn` usa os registros canônicos e o rateio financeiro já existente. A área **Virada de mês** aparece somente no último e no primeiro dia de meses envolvidos em serviços com horas nas duas competências. Cada serviço mostra militar, modalidade/atividade, OS/SEI, jornada integral e as duas parcelas, com horas, intervalos e valores. A cota do mês exibido recebe destaque; um total resume somente os serviços da virada nessa cota.

No cadastro atual, CAVALCANTE aparece em 30/11 e 01/12: 16h/R$ 486,00 de novembro e 8h/R$ 255,00 de dezembro, conservando o serviço de 24h/R$ 741,00. Múltiplos serviços ficam individualizados. Revisões e continuidade são resolvidas antes da apresentação; cancelados, inválidos e reforços simulados não entram no quadro. Término exatamente à meia-noite não cria parcela vazia. Os limites mensais, inclusive fevereiro bissexto e dezembro/janeiro, são determinados pelas datas dos serviços.

O quadro fica no rodapé financeiro do cartão, preservando o alinhamento das listas no computador. Cartões com o marcador HOJE usam fluxo vertical para que o marcador não desloque os controles das seções. No celular, os valores ficam ao lado de cada competência e os intervalos podem quebrar linha.

`tests/virada-mes-25nov.test.cjs` confere períodos/valores/documentos, saldos, cortes do ranking, rateio em ambos os dias, vários serviços, revisões, cancelamentos, simulação, meia-noite, ano bissexto e virada de ano. O teste reconstrói exatamente o calendário anterior, SHA-256 `e999de8cb3db818659497ad899c2d1a8a59edda64a38edcb173bbd00fefaf46f`, revertendo somente as alterações autorizadas e suas coberturas derivadas. As expectativas financeiras e fotografias de integridade anteriores foram atualizadas para esses dados. O roteiro de navegador confere os controles, cópia SEI, ES/OS, ranking, exclusões e apresentação em computador e celular com toque de 320/390px, sem enviar mensagens nem salvar cadastros privados.
