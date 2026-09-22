import React, { useMemo, useState } from 'react';
import { useApp, STATUS_COM_BOX_OCUPADO } from '../../context/AppContext.jsx';
import BoxCard from './BoxCard.jsx';
import { X, ArrowRightLeft } from 'lucide-react';
import { formatarDataHora } from '../../utils/dateHelpers';
import { getStatusLoja } from '../../utils/statusStyles';
import { getNomeBox } from '../../utils/boxLogic';
import MoveBoxModal from '../Shared/MoveBoxModal.jsx';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';
import AndamentoEntregasCard from '../Dashboard/AndamentoEntregasCard.jsx';

export default function BoxGrid({ irPara }) {
  const { state } = useApp();
  const [lojaDetalhe, setLojaDetalhe] = useState(null);
  const [lojaMover, setLojaMover] = useState(null);

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
          <BoxCard key={box.numero} box={box} lojasPorId={lojasPorId} aoSelecionarLoja={setLojaDetalhe} />
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

      {lojaDetalhe && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Detalhes da Loja</h3>
              <button onClick={() => setLojaDetalhe(null)} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                <X size={18} />
              </button>
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Carga</dt><dd className="font-semibold">{lojaDetalhe.carga}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Loja</dt><dd className="font-semibold">{lojaDetalhe.loja}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Nome</dt><dd className="font-semibold">{lojaDetalhe.nomeLoja}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Tipo de Carga</dt><dd><TipoCargaBadge tipo={lojaDetalhe.tipoCarga} /></dd></div>
              {lojaDetalhe.deposito && (
                <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Depósito</dt><dd className="font-semibold">{lojaDetalhe.deposito}</dd></div>
              )}
              {(lojaDetalhe.peso != null || lojaDetalhe.volume != null) && (
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">Peso / Volume</dt>
                  <dd className="font-semibold">{lojaDetalhe.peso ?? '—'} kg / {lojaDetalhe.volume ?? '—'} m³</dd>
                </div>
              )}
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Box</dt><dd className="font-semibold">{getNomeBox(lojaDetalhe.boxNumero)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Vagas</dt><dd className="font-semibold">{lojaDetalhe.vagasOcupadas.join(', ')}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Paletes</dt><dd className="font-semibold">{lojaDetalhe.paletesAgrupados}</dd></div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                <dd className="flex items-center gap-1.5 font-semibold">
                  <span className={`h-2 w-2 rounded-full ${getStatusLoja(lojaDetalhe.status).corPonto}`} />
                  {getStatusLoja(lojaDetalhe.status).texto}
                </dd>
              </div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Colaboradores</dt><dd className="text-right font-semibold">{lojaDetalhe.colaboradores.join(', ') || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Agrupada em</dt><dd className="font-semibold">{formatarDataHora(lojaDetalhe.dataAgrupamento)}</dd></div>
            </dl>

            {STATUS_COM_BOX_OCUPADO.includes(lojaDetalhe.status) && (
              <button
                onClick={() => {
                  setLojaMover(lojaDetalhe);
                  setLojaDetalhe(null);
                }}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/60 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              >
                <ArrowRightLeft size={13} /> Mover para outro Box
              </button>
            )}
          </div>
        </div>
      )}

      {lojaMover && <MoveBoxModal loja={lojaMover} aoFechar={() => setLojaMover(null)} />}
    </div>
  );
}
