import React, { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { diaReferenciaProtocolo } from '../../utils/selectors';
import SeletorCadastro from '../Shared/SeletorCadastro.jsx';

// Pedido do usuário: o "Alterar" dos Últimos Protocolos Registrados só
// corrigia a data de entrega. Agora abre esta janela, que também corrige
// placa, motorista e lacres de um protocolo já finalizado — sem cancelar
// (a carga não volta pro box; ver EDITAR_PROTOCOLO em AppContext.jsx). Vale
// pra todas as lojas da mesma viagem, já que veículo, motorista e lacres
// são os mesmos nelas.
export default function EditarProtocoloModal({ protocolo, quantidadeLojasDaViagem = 1, aoFechar }) {
  const { state, actions } = useApp();
  const [placa, setPlaca] = useState(protocolo.placa || '');
  const [motorista, setMotorista] = useState(protocolo.motorista || '');
  const [lacres, setLacres] = useState([0, 1, 2].map((i) => (protocolo.lacres || [])[i] || ''));
  const [dia, setDia] = useState(diaReferenciaProtocolo(protocolo).slice(0, 10));

  // Só oferece placas/motoristas que não estão em OUTRA viagem em andamento
  // (mesmo critério do formulário de protocolo) — mas sempre inclui o valor
  // atual do protocolo, mesmo que tenha sido removido do cadastro depois.
  const daMesmaViagem = (p) =>
    p.id === protocolo.id || (protocolo.viagemId != null && p.viagemId === protocolo.viagemId);
  const emOutraViagem = (state.protocolos || []).filter((p) => !p.saidaLoja && !daMesmaViagem(p));
  const placasEmUso = new Set(emOutraViagem.map((p) => p.placa));
  const motoristasEmUso = new Set(emOutraViagem.map((p) => p.motorista));
  const placasOpcoes = (state.placasCadastradas || [])
    .filter((p) => !placasEmUso.has(p.placa) || p.placa === protocolo.placa)
    .map((p) => ({ valor: p.placa, rotulo: p.placa, extra: p.possuiPlataforma ? 'c/ plataforma' : null }));
  if (protocolo.placa && !placasOpcoes.some((o) => o.valor === protocolo.placa)) {
    placasOpcoes.unshift({ valor: protocolo.placa, rotulo: protocolo.placa, extra: 'atual' });
  }
  const motoristasOpcoes = (state.motoristasCadastrados || []).filter(
    (m) => !motoristasEmUso.has(m) || m === protocolo.motorista
  );
  if (protocolo.motorista && !motoristasOpcoes.includes(protocolo.motorista)) {
    motoristasOpcoes.unshift(protocolo.motorista);
  }

  const valido = Boolean(placa && motorista && lacres[0].trim() && dia);

  function salvar(evento) {
    evento.preventDefault();
    if (!valido) return;
    actions.editarProtocolo(protocolo.id, { placa, motorista, lacres, dia });
    aoFechar();
  }

  const classeInput =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
  const classeRotulo = 'mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-label="Alterar protocolo">
      <form
        onSubmit={salvar}
        className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg bg-white p-5 shadow-2xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Pencil size={15} /> Alterar protocolo
          </h3>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Corrige o protocolo sem cancelar: a carga continua carregada, só mudam os dados abaixo.
          {quantidadeLojasDaViagem > 1 && (
            <strong className="text-slate-700 dark:text-slate-200"> Vale para as {quantidadeLojasDaViagem} lojas desta viagem.</strong>
          )}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={classeRotulo}>Placa do veículo</label>
            <SeletorCadastro
              opcoes={placasOpcoes}
              valor={placa}
              onSelecionar={setPlaca}
              placeholder="Selecione a placa"
              mensagemVazia="Nenhuma placa disponível — todas em viagem ou nada cadastrado."
            />
          </div>
          <div>
            <label className={classeRotulo}>Motorista</label>
            <SeletorCadastro
              opcoes={motoristasOpcoes}
              valor={motorista}
              onSelecionar={setMotorista}
              placeholder="Selecione o motorista"
              mensagemVazia="Nenhum motorista disponível — todos em viagem ou nada cadastrado."
            />
          </div>
        </div>

        <div>
          <label className={classeRotulo}>Lacres (até 3) — apenas o primeiro é obrigatório</label>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                value={lacres[i]}
                onChange={(e) => setLacres((prev) => prev.map((l, k) => (k === i ? e.target.value : l)))}
                placeholder={i === 0 ? 'Lacre 1' : `Lacre ${i + 1} (opcional)`}
                aria-label={`Lacre ${i + 1}`}
                inputMode="numeric"
                pattern="[0-9]*"
                className={classeInput}
              />
            ))}
          </div>
        </div>

        <div>
          <label className={classeRotulo}>Data de entrega</label>
          <input
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            aria-label="Nova data de entrega"
            className={classeInput}
          />
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Dia em que esse carregamento conta como entrega nos relatórios. O horário real do registro não muda.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valido}
            className="rounded-md bg-totvs-600 px-4 py-2 text-sm font-semibold text-white hover:bg-totvs-700 disabled:opacity-40 dark:bg-whatsapp-600 dark:hover:bg-whatsapp-700"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
