import React, { useMemo, useState } from 'react';
import { X, Search, MessageSquareText, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { eHoje } from '../../utils/dateHelpers';

// Descreve rapidamente a situação atual da loja na lista de busca — só pra
// dar contexto (não é uma tela de acompanhamento), já que essa busca
// propositalmente lista as lojas de HOJE independente do status: o pedido
// da loja (ex.: "colocar bag") costuma chegar antes mesmo dela ser apontada
// num box, e é exatamente por isso que essa tela não depende de box/vaga.
function descreverSituacao(loja) {
  if (loja.status === 'pendente') return 'Ainda não apontada';
  if (loja.status === 'finalizada') return 'Carregamento finalizado';
  if (loja.boxNumero) return `Box ${loja.boxNumero}`;
  return 'Em andamento';
}

/**
 * Modal acessível pelo botão "Observações das Lojas" no cabeçalho (ver
 * Header.jsx) — de propósito FORA das telas de Boxes/Agrupamento, pra
 * funcionar com a loja em qualquer status do dia, inclusive antes dela ser
 * apontada num box. Busca entre as lojas importadas hoje (mesma regra de
 * "hoje" usada no resto do app — ver eHoje/dataImportacao) por código ou
 * nome, e permite escrever/editar a observação de qualquer uma delas.
 *
 * A observação salva aqui aparece depois como lembrete ao abrir o
 * protocolo de carregamento dessa loja (ver LoadingProtocolForm.jsx).
 */
export default function ObservacoesLojaModal({ aoFechar }) {
  const { state, actions } = useApp();
  const [busca, setBusca] = useState('');
  const [lojaSelecionadaId, setLojaSelecionadaId] = useState(null);
  const [texto, setTexto] = useState('');
  const [salvo, setSalvo] = useState(false);

  const lojasHoje = useMemo(() => state.lojas.filter((l) => eHoje(l.dataImportacao)), [state.lojas]);

  const buscaNormalizada = busca.trim().toLowerCase();
  const resultados = useMemo(() => {
    const filtradas = buscaNormalizada
      ? lojasHoje.filter(
          (l) => l.loja.toLowerCase().includes(buscaNormalizada) || l.nomeLoja.toLowerCase().includes(buscaNormalizada)
        )
      : lojasHoje;
    // Lojas com observação já registrada aparecem primeiro — ajuda a
    // revisar rapidamente o que já foi anotado no dia, sem precisar buscar
    // uma por uma.
    return [...filtradas].sort((a, b) => {
      const temA = a.observacaoLoja ? 0 : 1;
      const temB = b.observacaoLoja ? 0 : 1;
      if (temA !== temB) return temA - temB;
      return a.loja.localeCompare(b.loja);
    });
  }, [lojasHoje, buscaNormalizada]);

  function selecionar(loja) {
    setLojaSelecionadaId((atual) => (atual === loja.id ? null : loja.id));
    setTexto(loja.observacaoLoja || '');
    setSalvo(false);
  }

  function salvar() {
    actions.definirObservacaoLoja(lojaSelecionadaId, texto);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <MessageSquareText size={18} className="text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Observações das Lojas</h3>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-slate-200 p-3 dark:border-slate-700">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Registre aqui um pedido da loja (ex.: colocar bag, material extra por fora) a qualquer
            momento do dia — não precisa a loja já estar apontada num box. A observação aparece como
            lembrete na hora de fazer o protocolo de carregamento dessa loja.
          </p>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código ou nome da loja..."
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
              {lojasHoje.length === 0
                ? 'Nenhuma loja importada hoje ainda.'
                : 'Nenhuma loja encontrada com esse código ou nome.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {resultados.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(l)}
                    className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                      lojaSelecionadaId === l.id ? 'bg-brand-50 dark:bg-brand-500/10' : ''
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                      {l.observacaoLoja && (
                        <MessageSquareText size={12} className="flex-shrink-0 text-amber-500" />
                      )}
                      <span className="truncate">
                        Loja {l.loja} — {l.nomeLoja}
                      </span>
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">{descreverSituacao(l)}</span>
                  </button>

                  {lojaSelecionadaId === l.id && (
                    <div className="space-y-2 bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
                      <textarea
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        rows={3}
                        placeholder="Ex.: Colocar bag para a loja / material extra por fora do palete..."
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={salvar}
                          className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          <Check size={13} />
                          Salvar observação
                        </button>
                        {salvo && (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Salvo!</span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
