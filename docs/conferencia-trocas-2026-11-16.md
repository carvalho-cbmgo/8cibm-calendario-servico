# Conferência de trocas e atualização de 16/11/2026

Foram lidos os consolidados `TROCAS-ENTRE-MILITARES-até-dia16-11-26.pdf` (26 páginas) e `TROCAS-ENTRE-MILITARES-SETEMBRO-OUTUBRO.pdf` (34 páginas). Também foi conferido o consolidado `TROCAS-COMPANHIA-até-dia11-11-26.pdf` (158 páginas), encontrado na mesma pasta. Os arquivos e dados pessoais permanecem fora do repositório.

## Reconferência do PDF reencaminhado

O arquivo de 26 páginas foi atualizado mantendo o mesmo nome. Seu SHA-256 atual é `ac5b10e7b564db80f848ed1cb6bf5a47497db4ec68195bf42c7a7bda9a98a6f5`. Na página 23, a contrapartida da **TS 167 (SEI 97933840)** passou de **01/01 para 05/01/2027**. A página 26 mantém a **TS 169 (SEI 98279694)** também em **05/01/2027**. Ambas indicam SCHUSSLER substituindo AISLAN por 24h, embora se refiram a serviços diferentes de novembro, em 07 e 15/11.

**Retificação expressa do usuário após a identificação da sobreposição:** manter a **TS 167 em 05/01/2027** e a **TS 169 em 09/01/2027**. Essa orientação prevalece sobre a data de 05/01 impressa na página 26 para a TS 169. A TS 167 corresponde ao serviço de AISLAN em 07/11 e a TS 169 ao de 15/11.

A referência antiga de 01/01 foi retirada. Em cada uma das datas de 05 e 09/01, SCHUSSLER substitui AISLAN por um único serviço de 24h, após as férias que terminam em 03/01. As referências recíprocas de novembro, dicas e ES foram atualizadas e as pendências anteriores removidas. Não foram criados AC4 nem duplicadas horas, cobertura ou militares.

As demais datas e substituições do PDF de 26 páginas foram reconferidas, incluindo a permuta tripla 164 e a troca parcial 168. O consolidado setembro/outubro permanece com SHA-256 `22565f677f89fd17527ef63cc31d048837d84a2a52cadedacaa9bede8e2f1406`: as TS 154, 159 e 160 continuam corretas, com HENRIQUE em 16/12 pela TS 159. As oito autorizações da companhia e suas 15 movimentações também foram conferidas; o consolidado da companhia de 11/11 mantém SHA-256 `0bce4d6f7a518adcca8d3df880ff5f176db2ef10b240394d796b320eee0d8caf`. Não foi encontrado consolidado posterior da companhia nessa pasta.

São 17 autorizações de TS com 29 movimentações físicas: 22 em novembro, cinco em dezembro e duas em janeiro, agora regularizadas. A unificação de 153/154 no mesmo serviço foi preservada. As demais informações abaixo registram o histórico da primeira conferência, anterior à retificação final das datas de janeiro.

## Histórico das primeiras alterações documentais

| TS | SEI | Atualização |
|---|---|---|
| 159 | 97553091 | A contrapartida de HENRIQUE por AISLAN passa de 26/11 para **16/12/2026**, conforme p. 32 do consolidado setembro/outubro, assinado novamente em 16/11. AISLAN retorna ao ordinário de 26/11; em 16/12 é substituído por HENRIQUE, sem duplicar o efetivo. A referência de 31/10 é preservada. |
| 167 | 97933840 | A contrapartida passa de 15/01 para **01/01/2027**, conforme p. 23 do consolidado atualizado. Coincide com as férias de SCHUSSLER. Por orientação do usuário, permanece pendente até regularização: SCHUSSLER não conta como disponível e a previsão ordinária de AISLAN é mantida. A primeira perna de 07/11 aponta para a nova data. |
| 169 | 98279694 | A contrapartida passa de 20/01 para **05/01/2027**, conforme p. 26. SCHUSSLER substitui AISLAN na Alpha, após suas férias. A primeira perna de 15/11 aponta para a nova data. |

O dia da semana impresso diverge das datas numéricas em alguns formulários, inclusive nos registros de janeiro. Foram usadas as datas numéricas expressas, sem inventar datas alternativas. As pendências antigas de 15 e 20/01 foram removidas. As demais TS foram preservadas, incluindo a unificação de 153/154, a permuta tripla 164 e os turnos complementares da 168.

Continuam representadas 17 autorizações de TS, em 29 movimentações: 22 em novembro, cinco em dezembro e duas em janeiro, sendo apenas a TS 167 pendente. As oito autorizações da companhia, com 15 movimentações no calendário, permanecem corretas e sem alteração. O histórico de janeiro/2026 não foi transferido para janeiro/2027. Não foi encontrado consolidado da companhia posterior ao de 11/11 nessa pasta.

## Férias e AC4 informados pelo usuário

- **2º SGT SCHUSSLER:** férias de **05/12/2026 a 03/01/2027**, inclusive. Foram retirados da disponibilidade os ordinários de 05, 09, 13, 17, 21, 25 e 29/12 e 02/01, mantendo a indicação de férias. O ordinário de 01/12 e o retorno em 06/01 foram preservados. A TS 169 de 05/01 ocorre após as férias.
- **3º SGT HENRIQUE:** um AC4 previsto de **PROEBOM em 17/11/2026, 08h–12h, 4h**, vinculado à **OS nº 374 (SEI 98399055)**. Pela tarifa já cadastrada, custa **R$ 120,00**. Não confirma execução ou pagamento e não acrescenta cobertura operacional nem reduz vagas simuladas.

Novembro passa a **71 AC4 e R$ 28.202,00 comprometidos**, sendo **R$ 21.782,00 operacionais e R$ 6.420,00 SAT**, com saldo de **R$ 17.398,00**. A execução confirmada permanece em **R$ 10.966,00**. Os 70 eventos anteriores foram preservados integralmente, assim como as 18 confirmações de escala, as tarifas e o código dos cálculos.

Com a meta geral de seis, dezembro passa a 31 recursos simulados adicionais (R$ 25.825,00) e janeiro a 24 (R$ 20.802,00). Esses valores são apenas simulação de cobertura; não representam AC4 designados nem presumem cota nesses meses.

## Validação

Os testes verificam as novas datas e referências recíprocas, o conflito da TS 167, férias e retorno, ES/dicas, consulta, ranking, exclusão do PROEBOM da cobertura e a preservação integral dos 70 eventos AC4 anteriores por comparação de SHA-256. Os PDFs não são necessários para executar os testes.
