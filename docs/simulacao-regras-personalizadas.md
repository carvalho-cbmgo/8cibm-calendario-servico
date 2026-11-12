# Simulação de reforço AC4 por semana e turno

A regra geral define de 4 a 8 recursos de 24h por serviço. Um recurso contínuo corresponde à cobertura de 08h até 08h do dia seguinte, incluindo os dois turnos de forma complementar.

Os botões SEG, TER, QUA, QUI, SEX, SAB e DOM começam desmarcados. Marcar um dia revela seus dois seletores, inicialmente iguais à regra geral atual. O usuário pode escolher metas distintas de 4 a 8 para Diurno (08h–20h) e Noturno (20h–08h). Esses valores substituem a regra geral naquele dia da semana. Desmarcar o dia oculta seus controles e restaura o uso da regra geral.

As regras são aplicadas pelo dia inicial do serviço: o noturno de sexta-feira continua seguindo a regra de sexta depois da meia-noite. Dias não personalizados usam a meta geral nos dois turnos. Escalas confirmadas e períodos com horários inválidos continuam excluídos dos reforços simulados.

O cálculo considera o efetivo já cadastrado em cada intervalo. Não remove militares quando uma meta é inferior ao efetivo existente. Reúne intervalos contíguos de reforço na mesma camada, formando AC4 de 24h quando a necessidade é comum aos dois turnos e AC4 parciais quando sobra necessidade em somente parte do plantão.

Exemplo ilustrativo, com cinco militares de 24h já disponíveis:

| Meta diurna | Meta noturna | Reforços simulados | Cobertura contínua resultante |
|---|---|---|---|
| 7 | 4 | Dois AC4 diurnos de 12h | 5 recursos de 24h |
| 4 | 8 | Três AC4 noturnos de 12h | 5 recursos de 24h |
| 6 | 8 | Um AC4 de 24h e dois noturnos de 12h | 6 recursos de 24h |

Assim, a quantidade de serviços simulados é distinguida da quantidade de recursos completos que eles compõem. O indicador de recursos conserva essa contabilização, e sua dica informa o efetivo e a meta de cada turno.

Confirmar aplica a regra geral, os dias selecionados, suas metas e o checkbox Aplicar Simulação em conjunto. Cancelar preserva a configuração anterior. Desligar a simulação mantém as configurações guardadas durante a sessão para reativação. As regras acompanham a navegação entre meses, mas não são gravadas no cadastro operacional; recarregar a página restaura os padrões.

As tarifas existentes calculam cada intervalo, inclusive as viradas de faixa e dia tarifário. Totais diários, acumulados, saldo, cabeçalho e contabilização semanal usam o mesmo plano. A janela de WhatsApp usa somente suas vagas PREVISTO AC4, agrupando horários iguais e separando períodos diferentes. O ranking e os documentos ES/OS continuam utilizando somente serviços cadastrados.

Na API local, `ServiceSimulation.plan(schedules, period, quota, base, target, rules)` recebe a regra geral em `target` e um objeto opcional `rules`, cujas chaves são os dias da semana (0 = domingo a 6 = sábado), com `{day, night}` para cada dia personalizado. Metas devem ser números inteiros de 4 a 8. `validateOptions` valida e copia os valores; omitir `rules` preserva a regra uniforme.
