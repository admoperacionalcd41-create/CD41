import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { boxEhEspecial } from '../../utils/boxLogic';
import BoxCard from './BoxCard.jsx';
import ResumoProcessoCard from './ResumoProcessoCard.jsx';
import AndamentoEntregasCard from '../Dashboard/AndamentoEntregasCard.jsx';

// `aoAbrirAgrupamento` (obrigatório na prática): chamado com a loja
// clicada — o App navega pra aba Agrupamento & Etiquetas e já abre a tela
// de etiquetas dessa loja lá (ver App.jsx e GroupingPage.jsx). É lá que
// ficam as outras ações da loja (mover de box, concluir agrupamento etc.).
export default function BoxGrid({ irPara, aoAbrirAgrupamento }) {
  const { state } = useApp();

  const lojasPorId = useMemo(() => {
    const mapa = {};
    state.lojas.forEach((l) => {
      mapa[l.id] = l;
    });
    return mapa;
  }, [state.lojas]);

  // Ordem de EXIBIÇÃO nesta tela (pedido do usuário): Box 2 ao Box 13
  // primeiro, e só depois os boxes "especiais" (BLOCADO 1, BLOCADO 2, Box
  // Frios) por último. Não muda o `numero` interno de cada box (usado em
  // toda alocação/movimentação de vaga) — só a ordem em que os cards
  // aparecem aqui.
  const boxesOrdenados = useMemo(
    () =>
      state.boxes.slice().sort((a, b) => {
        const especialA = boxEhEspecial(a.nome) ? 1 : 0;
        const especialB = boxEhEspecial(b.nome) ? 1 : 0;
        if (especialA !== especialB) return especialA - especialB;
        return a.numero - b.numero;
      }),
    [state.boxes]
  );

  // Pedido do usuário: em telas de notebook/desktop (xl pra cima), todos os
  // quadros (boxes) em APENAS DUAS LINHAS — 8 colunas de largura igual
  // (1fr), que é o número de colunas que cabe os 15 boxes em exatamente 2
  // linhas de 8+7. Cada card ocupa uma coluna, preenchendo a grade na mesma
  // ordem de cima. Os boxes especiais continuam identificáveis pela cor
  // (borda/fundo rosado no BoxCard), sem seção/divisor próprio (criaria
  // linhas extras).
  //
  // Em telas menores, 8 colunas fixas deixava cada card espremido demais
  // pra ler (celular/tablet) — por isso o número de colunas agora responde
  // ao tamanho da tela: menos colunas (e portanto mais linhas, com rolagem
  // vertical normal) quanto menor a tela. Precisa ser classes Tailwind
  // normais (não um valor calculado em JS/inline) porque só assim o
  // Tailwind aplica um breakpoint por vez — um `gridTemplateColumns`
  // calculado em JS não tem como variar por media query.
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Card pequeno pedido pelo usuário: junta o "Apontamento feito" do
          relatório Processo do Dia com o peso/volume do que ainda falta
          apontar hoje (estilo dos cards do Dashboard) — clicável, leva
          direto pro relatório completo. */}
      <ResumoProcessoCard irPara={irPara} />

      <div className="grid flex-shrink-0 grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {boxesOrdenados.map((box) => (
          <BoxCard key={box.numero} box={box} lojasPorId={lojasPorId} aoSelecionarLoja={aoAbrirAgrupamento} />
        ))}
      </div>

      {/* Mesmo card "Andamento das Entregas" do Dashboard, em versão
          compacta (menos respiro). Ocupa toda a altura que sobrar abaixo da
          grade de boxes (min-h-0 + flex-1) e só a lista de veículos dentro
          dele rola, se precisar — pensado pra caber junto com a grade de
          boxes sem que a tela precise rolar, mesmo em monitores baixos. */}
      <div className="min-h-0 flex-1">
        <AndamentoEntregasCard irPara={irPara} compacto />
      </div>
    </div>
  );
}
