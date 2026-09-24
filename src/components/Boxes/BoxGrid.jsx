import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import BoxCard from './BoxCard.jsx';
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex-shrink-0 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-8 2xl:grid-cols-10">
        {state.boxes.map((box) => (
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
