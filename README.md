# Gestão de Docas — Separação e Carregamento

Sistema web (SPA) para gestão logística de docas (boxes), separação de paletes por loja e
protocolo de carregamento. Construído com **React + Vite + Tailwind CSS**, com estado em
memória persistido em **localStorage** (sem backend — pronto para testar imediatamente).

## Como rodar

```bash
npm install
npm run dev       # ambiente de desenvolvimento (http://localhost:5173)
npm run build     # build de produção em /dist
npm run preview   # serve o build de produção localmente
```

Ao abrir pela primeira vez, o app carrega automaticamente um conjunto de **dados de exemplo**
(28 lojas planejadas para hoje, 3 lojas de saldo do dia anterior, alguns agrupamentos e um
carregamento já finalizado), para que todas as telas possam ser exploradas de imediato. Use o
botão **"Restaurar Exemplo"** no cabeçalho a qualquer momento para voltar a esse estado inicial.

## Estrutura de arquivos

```
src/
  main.jsx                     Ponto de entrada — monta o AppProvider e o App
  App.jsx                      Shell da SPA; abas simuladas via useState (sem router)
  index.css                    Tailwind + estilos de impressão de etiquetas

  context/
    AppContext.jsx             Estado global (reducer) + persistência em localStorage

  data/
    mockData.js                Gerador dos dados de exemplo (28 lojas, boxes, protocolos)

  hooks/
    useLocalStorage.js         Hook genérico de persistência

  utils/
    boxLogic.js                Lista de boxes (nome/capacidade) e alocação de vagas (reverse-fill)
    parseImport.js             Parser de dados colados (Excel/CSV) para importação em massa
    selectors.js                Seletores derivados do estado (cards do dashboard, filas, etc.)
    statusStyles.js              Padrão único de cores/rótulos por status da loja (Boxes, Agrupamento, Carregamento)
    dateHelpers.js              Formatação de datas e cálculo de "dia operacional"
    idGenerator.js               Geração de IDs únicos

  components/
    Layout/
      Sidebar.jsx               Navegação principal (abas)
      Header.jsx                Cabeçalho, dia operacional, encerrar dia, mensagens
    Dashboard/
      Dashboard.jsx             Cards de resumo + mapa de ocupação dos boxes
      SummaryCard.jsx
    Import/
      DataImport.jsx            Área de colar dados (Excel/CSV) com pré-visualização
    Boxes/
      BoxGrid.jsx                Grade de todos os boxes
      BoxCard.jsx                Visualização de vagas de um box + modal de detalhes da loja
    Grouping/
      GroupingPage.jsx           Container: formulário + board + histórico
      GroupingForm.jsx           Etapa 1 — Apontamento (carga/loja, box, quantidade estimada)
      GroupingBoard.jsx           Board em 4 colunas (Em Execução / Conferência Finalizada / Agrupando / Agrupada)
      GroupingCard.jsx            Card de uma loja no board, com ações da etapa atual
      GroupingHistory.jsx         Lista recolhível de lojas em carregamento/finalizadas (reimprimir etiquetas)
      MoveBoxModal.jsx (em Shared/) Movimentação de uma loja para outro box
      StartGroupingModal.jsx     Etapa 3 — Início do agrupamento (define até 4 colaboradores)
      ConcludeGroupingModal.jsx  Etapa 4 — Conclusão (reconfirma quantidade final de paletes)
      LabelGenerator.jsx         Gerador/visualizador de etiquetas (Palete i/N) + impressão
    Shared/
      MoveBoxModal.jsx           Modal de movimentação de box, reusado em Boxes e Agrupamento
    Loading/
      LoadingPage.jsx             Container: listas + formulário de protocolo
      LoadingList.jsx             Filas "prontas para carregar" / "em carregamento" + histórico
      LoadingProtocolForm.jsx     Formulário de protocolo (placa, motorista, lacres, saldo)
    Reports/
      ProductivityReport.jsx     Produtividade por colaborador (paletes agrupados, ranking)
    Registrations/
      RegistrationsPage.jsx      Container: os 3 cartões de cadastro lado a lado
      RegistrationList.jsx       Cartão de cadastro genérico (input + lista + remover) — Colaboradores/Motoristas
      PlacasRegistrationList.jsx Cartão de cadastro de Placas (placa + Sim/Não possui plataforma)
```

## Regras de negócio implementadas

### 1. Dashboard
- **Lojas planejadas hoje**: total de lojas cujo dia de referência é o dia operacional atual.
- **Lojas finalizadas**: lojas cujo carregamento foi concluído no dia real de hoje.
- **Lojas pendentes**: pendentes de hoje **+ saldo acumulado** de dias anteriores ainda não
  finalizados (lojas cujo dia de referência é anterior ao dia operacional atual).
- **Cargas em carregamento**: lojas com protocolo de carregamento iniciado, aguardando a
  finalização (placa/lacres/status de envio).
- O botão **"Encerrar Dia"** avança o dia operacional; tudo que não foi finalizado passa a
  contar automaticamente como saldo do dia anterior no próximo dia.

### 2. Importação de dados
- Área de colagem que aceita o formato real exportado pelo sistema de origem — colunas
  **S.D, P, DATA, DIA, CARGA, DEP, DESTINO, PESO, VOLUME, USUARIO** — colado do Excel (TAB),
  CSV (vírgula) ou ponto-e-vírgula. Nenhuma digitação linha a linha é necessária. O parser
  (`src/utils/parseImport.js`):
  - **A linha de cabeçalho é opcional.** Se a primeira linha colada for reconhecida como título
    (por nome de coluna), ela é usada para mapear os campos; caso contrário, todas as linhas são
    tratadas como dados e as colunas são identificadas pela **posição**, desde que o número de
    colunas bata com um dos layouts conhecidos: 10 colunas (S.D, P, DATA, DIA, CARGA, DEP,
    DESTINO, PESO, VOLUME, USUARIO), 8 colunas (o mesmo formato sem S.D/P), 5 colunas (Carga,
    Loja, Nome da Loja, Paletes, Região) ou 4 colunas (sem Região). Se o número de colunas não
    bater com nenhum desses layouts, a importação pede para incluir a linha de título.
  - Ignora as colunas sem uso (`S.D`, `P`).
  - Junta as duas colunas de data (`DATA` + `DIA`, mesmo quando têm nomes diferentes) em um
    único timestamp de geração da carga (data + hora), guardado em `dataGeracaoISO`.
  - Separa automaticamente código e nome do "Destino", em dois formatos: com separador
    explícito (`"0501 - Loja Centro"` → loja `0501`, nome `Loja Centro`) ou grudado, no padrão
    `"CIDADE LOJAnn"` (`"CARUARU LOJA32"` → loja `LOJA32`, nome `CARUARU`); se nenhum padrão for
    reconhecido, gera um código interno (`AUTO-001`).
  - Converte Peso/Volume em número no formato brasileiro: vírgula é sempre separador decimal
    (`"16,722"` → `16.722`); um ponto seguido de grupos de exatamente 3 dígitos e sem vírgula é
    tratado como separador de milhar, não decimal (`"6.161"` → `6161`, não `6.161`) — assim como
    aparece nos pesos em kg do sistema de origem.
  - **Não usa Peso/Volume como quantidade de paletes** — são medidas físicas diferentes. A
    quantidade de paletes continua sendo definida manualmente na tela de Agrupamento, a partir
    da conferência física da carga.
  - Mantém compatibilidade com o formato simplificado antigo (Carga, Loja, Nome da Loja,
    Paletes, Região), caso ele ainda seja usado em algum fluxo manual.

### 3. Gestão dos boxes e vagas (regra crítica — alocação em duas fases)
- 14 boxes ao todo, cada um com nome e capacidade próprios, definidos em `CONFIG_BOXES`
  (`src/utils/boxLogic.js`): **BLOCADO 1** (36 vagas), Box 2 a Box 8 (26 vagas cada), Box 9 a
  Box 13 (18 vagas cada) e **BLOCADO 2** (42 vagas), que fica sempre por último, na sequência
  logo depois do Box 13. Para adicionar, renomear ou redimensionar um box no futuro, basta editar
  essa lista — todas as telas (Boxes, Agrupamento, Carregamento, Dashboard, etiquetas) usam
  `getNomeBox()`/`getTotalVagas()` e nunca um número de box "cru".
- **Fase 1 — Apontamento (crescente)**: o apontamento manual inicial da loja para o box ocupa
  sempre as vagas **livres de menor numeração** (1, 2, 3...), já que a quantidade informada
  nessa etapa é apenas uma estimativa rápida, feita antes da conferência física da carga.
- **Fase 2 — Agrupamento (decrescente/preenchimento reverso)**: ao iniciar o agrupamento físico,
  a quantidade de paletes é reconferida (**geralmente menor** que a estimativa do apontamento) e
  as vagas da loja são liberadas e realocadas para a regra clássica de preenchimento reverso —
  sempre as vagas **livres de maior numeração** disponíveis no box (do limite máximo para baixo).
  Ex.: 6 paletes confirmados em um box vazio de 1–26 passam a ocupar 26,25,24,23,22,21, liberando
  1–20 para outro agrupamento no mesmo box.
- O cálculo de vagas disponíveis é automático e em tempo real (`getResumoBox`).
- **Cor por status, não por loja**: as vagas ocupadas e as bolinhas de identificação da loja usam
  um padrão único de cores por status (`src/utils/statusStyles.js`) — o mesmo em todas as telas
  (Boxes, Agrupamento, Carregamento) — para diferenciar de relance uma loja **"Em Execução"**
  (apontada, âmbar) de uma loja **"Agrupada"** (azul) ou nos demais status (agrupando, em
  carregamento, finalizada), inclusive dentro do mesmo box.
- Ao finalizar um carregamento (envio completo), as vagas daquela loja são liberadas
  imediatamente. Em caso de **saldo parcial**, apenas a quantidade de vagas correspondente aos
  paletes efetivamente enviados é liberada — o restante permanece alocado até um novo protocolo.

### 4. Agrupamento e etiquetas — fluxo em 4 etapas
O processo físico real é modelado em quatro etapas distintas, cada uma com seu próprio status
(`src/context/AppContext.jsx`):

1. **Apontamento** (`pendente` → `apontada`): o operador aponta manualmente a loja para um box e
   informa a quantidade **estimada** de paletes. As vagas são reservadas imediatamente em ordem
   **crescente** (1, 2, 3...), e a loja passa a aparecer como **"Em Execução"** — sinalizando que
   já está reservada, mas a conferência física ainda não foi concluída. Nenhum colaborador é
   informado nessa etapa (`GroupingForm.jsx`).
2. **Conferência Finalizada** (`apontada` → `conferencia_finalizada`): marco simples, sem dados
   adicionais, que sinaliza que a conferência física da carga apontada no box foi concluída — a
   loja fica visível como **"Conferência Finalizada"**, aguardando a sinalização dos colaboradores
   para iniciar o agrupamento propriamente dito. Vagas e quantidade permanecem inalteradas.
3. **Início do Agrupamento** (`conferencia_finalizada` → `em_agrupamento`): o operador informa
   **somente os colaboradores** (até 4, com sugestão automática por nomes já cadastrados) que
   estão montando a carga. A quantidade de paletes e as vagas permanecem inalteradas nessa etapa
   (ainda as vagas crescentes do apontamento). A loja aparece como **"Agrupando"**
   (`StartGroupingModal.jsx`).
4. **Conclusão do Agrupamento** (`em_agrupamento` → `agrupada`): só agora o operador reconfirma a
   quantidade de paletes após a conferência física — **geralmente menor** que a estimativa do
   apontamento. Nesse momento as vagas crescentes do apontamento são liberadas e realocadas em
   ordem **decrescente** (preenchimento reverso clássico) para a quantidade final informada, e a
   loja fica pronta para gerar etiqueta e seguir para o carregamento (`ConcludeGroupingModal.jsx`).

Um agrupamento pode ser **cancelado** em qualquer uma das quatro etapas (apontada,
conferencia_finalizada, em_agrupamento ou agrupada) — as vagas são liberadas e a loja volta para
a fila de pendentes.

**Layout da tela**: o apontamento (`GroupingForm.jsx`) é uma barra compacta no topo. Abaixo, um
**board em 4 colunas** (`GroupingBoard.jsx`) — Em Execução / Conferência Finalizada / Agrupando /
Agrupada — mostra cada loja como um cartão (`GroupingCard.jsx`) com uma borda colorida por status
(mesmo padrão de `statusStyles.js`), os dados relevantes daquela etapa e os botões de ação certos
para avançar, gerar etiquetas ou cancelar. Lojas que já saíram para carregamento ou foram
finalizadas ficam numa seção recolhível ao final (`GroupingHistory.jsx`), só para consulta e
reimpressão de etiquetas.

- Gerador de etiquetas por palete (**"Palete 1/6", "2/6"...**) com carga, loja, box, quantidade
  total e colaboradores responsáveis, pronto para impressão (`window.print()` com CSS dedicado
  que imprime apenas a área de etiquetas). Disponível a partir da etapa "agrupada".

### 5. Protocolo de carregamento e liberação
- Fluxo em duas etapas para refletir com precisão o card "Cargas em carregamento": uma loja
  agrupada é primeiro marcada como **"Em Carregamento"**, e só então o protocolo (placa,
  motorista, até 3 lacres, status de envio completo/saldo) é registrado para finalizar.
- Ao finalizar com envio completo, o box é limpo e as vagas voltam a ficar disponíveis. Em caso
  de saldo, o restante de paletes permanece no box até um novo carregamento.

### 6. Controle de produtividade
- Relatório que cruza cada colaborador com as lojas que ele/ela ajudou a agrupar, somando os
  paletes (valor fixado no momento do agrupamento, preservado mesmo que a loja tenha saída
  parcial depois) e calculando a média de paletes por loja atendida. Filtro por "hoje" ou todo
  o período.

### 7. Cadastros (Colaboradores, Motoristas, Placas de Veículo)
- Tela dedicada (`RegistrationsPage.jsx`) com três cartões independentes — um por lista — cada
  um com um campo de adicionar e a lista de itens já cadastrados, com botão de remover por item.
- As três listas (`colaboradoresCadastrados`, `motoristasCadastrados`, `placasCadastradas`) vivem
  em `state` e são gerenciadas por duas ações genéricas no reducer (`CADASTRAR_ITEM`/
  `REMOVER_ITEM`, parametrizadas por `entidade`), em vez de seis ações específicas repetidas.
  Colaboradores/Motoristas são listas simples de strings (`RegistrationList.jsx`); Placas é a
  exceção — cada item também guarda **se o veículo possui plataforma** (Sim/Não), então usa seu
  próprio cartão (`PlacasRegistrationList.jsx`) com `{ placa, possuiPlataforma }`.
- Cadastro duplicado (mesmo texto, sem diferenciar maiúsculas/minúsculas) é bloqueado; placas são
  sempre normalizadas em maiúsculas ao cadastrar.
- **Não são listas fechadas**: elas alimentam a sugestão automática (`<datalist>`) nos campos de
  colaboradores (`StartGroupingModal.jsx`), motorista e placa (`LoadingProtocolForm.jsx`) — mas
  continuam aceitando digitação livre de um nome/placa ainda não cadastrado, para não travar a
  operação por causa de um cadastro esquecido. Ao digitar uma placa já cadastrada no protocolo de
  carregamento, o formulário mostra automaticamente se aquele veículo possui plataforma.
- Uma sessão salva antes da criação do campo "possui plataforma" tinha `placasCadastradas` como
  lista de strings simples; a sincronização automática ao abrir o app (`SINCRONIZAR_CADASTROS`)
  converte esse formato antigo para `{ placa, possuiPlataforma: false }` sem perder nenhuma placa
  já cadastrada.

## Decisões de implementação (premissas)

- **Sem backend/Supabase real**: para permitir testes imediatos, o estado inteiro fica em
  `localStorage` via `useLocalStorage`. O `AppContext` foi desenhado com um reducer puro
  (`aplicarAcao`) que pode ser facilmente adaptado para chamadas assíncronas a uma tabela
  Supabase (basta trocar `setState` local por `insert/update` no Supabase e sincronizar via
  `onSnapshot`/subscription).
- **"Box é limpo" ao finalizar**: interpretado como liberação das vagas daquela loja
  especificamente (não do box inteiro), já que um box pode abrigar paletes de mais de uma loja
  simultaneamente antes de ambas saírem — isso é o que torna as vagas remanescentes
  reaproveitáveis, exatamente como descrito na regra de agrupamento.
- **Histórico preservado**: mesmo após a loja ser finalizada e as vagas liberadas, o registro
  da loja mantém `boxNumero`/`vagasOcupadas`/`colaboradores` para consulta e reimpressão de
  etiquetas — apenas o estado físico do box (`state.boxes`) reflete a ocupação atual.
