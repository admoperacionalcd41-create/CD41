import React, { useState } from 'react';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import caminhaoImg from '../../assets/caminhao-vista-cima.png';

// Proporção real do PNG gerado (ver src/assets) — usada pra manter a
// imagem sempre no formato certo, e pra calcular em que faixa (em %) fica a
// área do baú, onde a lista de posições fica sobreposta.
const RAZAO_ALTURA_LARGURA = 700 / 220;
// Faixa aproximada (em % da altura/largura da imagem) ocupada pelo baú
// (carroceria) — o resto é a cabine, acima, e uma margem nas laterais.
const BAU_TOPO_PCT = 21.5;
const BAU_BASE_PCT = 3;
const BAU_ESQUERDA_PCT = 10;
const BAU_DIREITA_PCT = 10;

/**
 * Sequência de carregamento pra um protocolo em lote (2+ lojas no mesmo
 * veículo): o operador arrasta (ou usa as setas) os cartões das lojas por
 * cima do desenho do baú do caminhão, de cima (perto da cabine) pra baixo
 * (perto das portas traseiras), pra registrar em que ordem cada uma vai ser
 * carregada. Como quem carrega por último fica mais perto da porta, essa é
 * a primeira a ser entregue — e quem é carregada primeiro (lá no fundo,
 * perto da cabine) só é entregue por último. `ordem` é um array de ids de
 * loja (posição 0 = carregada primeiro); `aoAlterarOrdem` recebe o novo
 * array a cada reordenação.
 */
export default function SequenciaCarregamentoCaminhao({ lojas, ordem, aoAlterarOrdem }) {
  const [arrastandoId, setArrastandoId] = useState(null);
  const lojasPorId = Object.fromEntries(lojas.map((l) => [l.id, l]));
  const total = ordem.length;

  function moverPara(indiceAtual, indiceNovo) {
    if (indiceNovo < 0 || indiceNovo >= total || indiceNovo === indiceAtual) return;
    const nova = [...ordem];
    const [item] = nova.splice(indiceAtual, 1);
    nova.splice(indiceNovo, 0, item);
    aoAlterarOrdem(nova);
  }

  function aoSoltarSobre(indiceDestino) {
    if (arrastandoId == null) return;
    const indiceOrigem = ordem.indexOf(arrastandoId);
    if (indiceOrigem === -1) return;
    moverPara(indiceOrigem, indiceDestino);
    setArrastandoId(null);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        Sequência de carregamento do caminhão
      </p>
      <p className="mb-3 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
        Arraste (ou use as setas) para organizar a ordem em que cada loja entra no baú, de cima pra
        baixo. A primeira carregada fica no fundo — perto da cabine — e por isso é a{' '}
        <strong className="text-slate-500 dark:text-slate-400">última a ser entregue</strong>; a
        última carregada fica perto da porta e é a{' '}
        <strong className="text-slate-500 dark:text-slate-400">primeira a ser entregue</strong>.
      </p>

      <div className="mx-auto" style={{ width: 170, maxWidth: '100%' }}>
        <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          ▲ Frente / Cabine
        </p>

        <div className="relative" style={{ width: '100%', paddingTop: `${RAZAO_ALTURA_LARGURA * 100}%` }}>
          <img
            src={caminhaoImg}
            alt="Caminhão visto de cima"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
          />
          <div
            className="absolute flex flex-col gap-1 overflow-y-auto"
            style={{
              top: `${BAU_TOPO_PCT}%`,
              bottom: `${BAU_BASE_PCT}%`,
              left: `${BAU_ESQUERDA_PCT}%`,
              right: `${BAU_DIREITA_PCT}%`,
            }}
          >
            {ordem.map((lojaId, indice) => {
              const l = lojasPorId[lojaId];
              if (!l) return null;
              const primeira = indice === 0;
              const ultima = indice === total - 1;
              return (
                <div
                  key={lojaId}
                  draggable
                  onDragStart={() => setArrastandoId(lojaId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => aoSoltarSobre(indice)}
                  onDragEnd={() => setArrastandoId(null)}
                  title={`${l.loja} — ${l.nomeLoja} — ${
                    primeira ? 'carregada 1ª, entregue por último' : ultima ? 'carregada por último, entregue 1ª' : `posição ${indice + 1} de ${total}`
                  }`}
                  className={`flex min-h-[34px] flex-shrink-0 items-center gap-1 rounded-md border bg-white/95 px-1.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm dark:bg-slate-800/95 dark:text-slate-200 ${
                    arrastandoId === lojaId
                      ? 'cursor-grabbing border-brand-400 opacity-60 dark:border-brand-500'
                      : 'cursor-grab border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <GripVertical size={12} className="flex-shrink-0 text-slate-300 dark:text-slate-600" />
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    {indice + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{l.loja}</span>
                  <div className="flex flex-shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => moverPara(indice, indice - 1)}
                      disabled={primeira}
                      title="Carregar mais cedo (mover pra cima)"
                      className="text-slate-300 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverPara(indice, indice + 1)}
                      disabled={ultima}
                      title="Carregar mais tarde (mover pra baixo)"
                      className="text-slate-300 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300"
                    >
                      <ChevronDown size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Traseira / Portas ▼
        </p>
      </div>

      <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
        Ordem de entrega prevista:{' '}
        {[...ordem]
          .map((id) => lojasPorId[id])
          .filter(Boolean)
          .reverse()
          .map((l) => l.loja)
          .join(' → ')}
      </p>
    </div>
  );
}
