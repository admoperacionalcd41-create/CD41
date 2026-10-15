import React, { useMemo, useState } from 'react';
import { X, Search, MessageSquareText, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { eHoje } from '../../utils/dateHelpers';
import { getLojasConhecidas } from '../../utils/selectors';

// Descreve rapidamente a situação da loja HOJE, pra dar contexto na lista de
// busca (não é uma tela de acompanhamento) — mas a busca em si já não se
// limita mais a lojas com carga hoje (ver comentário no componente abaixo),
// então aqui é só mais uma informação, não o critério de quem aparece.
// `cargasHoje` é a lista de registros de hoje pra esse código (pode ter mais
// de um — ver DailyProcessReport.jsx sobre lojas com mais de uma carga no
// dia) ou vazia quando a loja não tem nenhuma carga hoje.
function descreverSituacao(cargasHoje) {
  if (!cargasHoje || cargasHoje.length === 0) return 'Sem carga hoje';
  if (cargasHoje.length > 1) return `${cargasHoje.length} cargas hoje`;
  const loja = cargasHoje[0];
  if (loja.status === 'pendente') return 'Carga ainda não gerada';
  if (loja.status === 'finalizada') return 'Carregamento finalizado';
  if (loja.boxNumero) return `Box ${loja.boxNumero}`;
  return 'Em andamento';
}

/**
 * Modal acessível pelo botão "Observações das Lojas" no cabeçalho (ver
 * Header.jsx) — de propósito FORA das telas de Boxes/Agrupamento, pra
 * funcionar com a loja em qualquer status do dia, inclusive antes dela ter
 * a carga gerada num box. Busca por código ou nome entre TODAS as lojas já
 * conhecidas pelo sistema (ver getLojasConhecidas em selectors.js) — pedido
 * do usuário: antes listava só as importadas hoje, o que impedia anotar uma
 * loja que ainda não teve carga importada no dia; agora a observação é da
 * loja (identificada só pelo código), não de uma carga/importação
 * específica, então faz sentido já poder anotar qualquer loja conhecida.
 *
 * A observação salva aqui aparece depois como lembrete ao abrir o
 * protocolo de carregamento dessa loja (ver LoadingProtocolForm.jsx), pra
 * qualquer carga dessa loja, não só a de hoje.
 */
export default function ObservacoesLojaModal({ aoFechar }) {
  const { state, actions } = useApp();
  const [busca, setBusca] = useState('');
  const [codigoSelecionado, setCodigoSelecionado] = useState(null);
  const [texto, setTexto] = useState('');
  const [salvo, setSalvo] = useState(false);

  const lojasConhecidas = useMemo(() => getLojasConhecidas(state), [state.lojas]);

  // Cargas de HOJE por código de loja — só pra enriquecer a lista com a
  // situação atual (ver descreverSituacao acima); não filtra quem aparece.
  const cargasHojePorCodigo = useMemo(() => {
    const mapa = new Map();
    state.lojas
      .filter((l) => eHoje(l.dataImportacao))
      .forEach((l) => {
        if (!mapa.has(l.loja)) mapa.set(l.loja, []);
        mapa.get(l.loja).push(l);
      });
    return mapa;
  }, [state.lojas]);

  const observacoesLoja = state.observacoesLoja || {};

  const buscaNormalizada = busca.trim().toLowerCase();
  const resultados = useMemo(() => {
    const filtradas = buscaNormalizada
      ? lojasConhecidas.filter(
          (l) => l.codigo.toLowerCase().includes(buscaNormalizada) || l.nomeLoja.toLowerCase().includes(buscaNormalizada)
        )
      : lojasConhecidas;
    // Lojas com observação já registrada aparecem primeiro — ajuda a
    // revisar rapidamente o que já foi anotado, sem precisar buscar uma por
    // uma.
    return [...filtradas].sort((a, b) => {
      const temA = observacoesLoja[a.codigo] ? 0 : 1;
      const temB = observacoesLoja[b.codigo] ? 0 : 1;
      if (temA !== temB) return temA - temB;
      return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  }, [lojasConhecidas, buscaNormalizada, observacoesLoja]);

  function selecionar(loja) {
    setCodigoSelecionado((atual) => (atual === loja.codigo ? null : loja.codigo));
    setTexto(observacoesLoja[loja.codigo] || '');
    setSalvo(false);
  }

  function salvar() {
    actions.definirObservacaoLoja(codigoSelecionado, texto);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <MessageSquareText size={18} className="text-totvs-600 dark:text-whatsapp-400" />
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
            momento — não precisa a loja já estar apontada num box, nem ter carga importada hoje. A
            observação fica salva na loja (vale pra qualquer carga dela) e aparece como lembrete na
            hora de fazer o protocolo de carregamento.
          </p>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código ou nome da loja..."
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs text-slate-800 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
              {lojasConhecidas.length === 0
                ? 'Nenhuma loja registrada ainda.'
                : 'Nenhuma loja encontrada com esse código ou nome.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {resultados.map((l) => (
                <li key={l.codigo}>
                  <button
                    type="button"
                    onClick={() => selecionar(l)}
                    className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                      codigoSelecionado === l.codigo ? 'bg-totvs-50 dark:bg-whatsapp-500/10' : ''
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                      {observacoesLoja[l.codigo] && (
                        <MessageSquareText size={12} className="flex-shrink-0 text-amber-500" />
                      )}
                      <span className="truncate">
                        Loja {l.codigo} — {l.nomeLoja}
                      </span>
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      {descreverSituacao(cargasHojePorCodigo.get(l.codigo))}
                    </span>
                  </button>

                  {codigoSelecionado === l.codigo && (
                    <div className="space-y-2 bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
                      <textarea
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        rows={3}
                        placeholder="Ex.: Colocar bag para a loja / material extra por fora do palete..."
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={salvar}
                          className="flex items-center gap-1.5 rounded-md bg-totvs-600 dark:bg-whatsapp-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-totvs-700 dark:hover:bg-whatsapp-700"
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
