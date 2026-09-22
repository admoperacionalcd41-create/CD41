import React, { useState } from 'react';
import { ClipboardPaste, CheckCircle2, AlertCircle, Trash2, FileSpreadsheet, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { parseDadosColados, MODELO_EXEMPLO } from '../../utils/parseImport';
import { formatarDataHora } from '../../utils/dateHelpers';
import { TIPOS_CARGA } from '../../utils/tipoCarga';
import { exportarRelatoriosParaExcel } from '../../utils/exportExcel';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

const ROTULO_TIPO_FILTRO = {
  seca: 'Carga Seca',
  resfriada: 'Carga Resfriada',
  todos: 'Seca + Resfriada',
};

export default function DataImport() {
  const { state, actions, filtroTipoCarga } = useApp();
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null);
  const [exportando, setExportando] = useState(false);
  // A planilha de origem não traz essa informação — o operador define uma
  // vez por lote colado (seca OU resfriada), e ela é aplicada a todas as
  // lojas desse lote na importação. Ver utils/tipoCarga.js.
  const [tipoCarga, setTipoCarga] = useState('seca');

  function processar() {
    const res = parseDadosColados(texto);
    setResultado(res);
  }

  function confirmar() {
    if (!resultado?.registros?.length) return;
    actions.importarLojas(resultado.registros.map((r) => ({ ...r, tipoCarga })));
    setTexto('');
    setResultado(null);
  }

  async function exportarExcel() {
    setExportando(true);
    try {
      await exportarRelatoriosParaExcel(state, filtroTipoCarga);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardPaste size={18} className="text-brand-600" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Colar dados de cargas e lojas</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Cole diretamente as colunas exportadas pelo sistema de origem — <strong>S.D, P, DATA, DIA,
          CARGA, DEP, DESTINO, PESO, VOLUME, USUARIO</strong> (S.D e P são ignoradas). <strong>A linha de
          cabeçalho é opcional</strong> — se ela não vier, o sistema identifica as colunas pela posição,
          desde que sigam essa ordem (com ou sem S.D/P no início). O sistema detecta automaticamente o
          separador (tabulação, vírgula ou ponto-e-vírgula), junta as colunas de data/hora e separa
          código e nome do Destino — funciona tanto no formato "0501 - Loja Centro" quanto grudado, como
          "CARUARU LOJA32". Não é necessário digitar linha a linha. A quantidade de paletes é definida
          depois, na tela de Agrupamento, a partir da conferência física da carga.
        </p>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Tipo de carga deste lote
          </label>
          <p className="mb-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            A planilha de origem não traz essa informação — escolha aqui o tipo de todas as lojas coladas
            abaixo. Se precisar importar os dois tipos no mesmo dia, cole e confirme cada tipo separadamente.
          </p>
          <div className="flex overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-600 w-fit">
            {TIPOS_CARGA.map((t) => (
              <button
                key={t.chave}
                type="button"
                onClick={() => setTipoCarga(t.chave)}
                className={`px-4 py-1.5 font-medium ${
                  tipoCarga === t.chave
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {t.texto}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Exemplo:\n${MODELO_EXEMPLO}`}
          rows={10}
          className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={processar}
            disabled={!texto.trim()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Processar Dados
          </button>
          <button
            onClick={() => {
              setTexto('');
              setResultado(null);
            }}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Trash2 size={14} /> Limpar
          </button>
          <button
            onClick={() => setTexto(MODELO_EXEMPLO)}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Usar exemplo
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Exportar Relatórios para Excel</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Baixa uma planilha (.xlsx) com uma aba para cada relatório da aba Relatórios: Meta de Entrega
          (resumo diário e análise por loja), Tempo de Permanência do Motorista, Lojas Entregues por
          Motorista e Produtividade por Colaborador — considerando o filtro de tipo de carga selecionado
          no cabeçalho no momento da exportação ({ROTULO_TIPO_FILTRO[filtroTipoCarga] || ROTULO_TIPO_FILTRO.todos}).
        </p>
        <button
          onClick={exportarExcel}
          disabled={exportando}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={16} />
          {exportando ? 'Gerando arquivo...' : 'Exportar para Excel'}
        </button>
      </div>

      {resultado && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Pré-visualização — {resultado.registros.length} loja(s) válida(s)
              {resultado.erros.length > 0 && `, ${resultado.erros.length} linha(s) com erro`}
              <TipoCargaBadge tipo={tipoCarga} />
            </h3>
            {resultado.registros.length > 0 && (
              <button
                onClick={confirmar}
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <CheckCircle2 size={16} />
                Confirmar Importação
              </button>
            )}
          </div>

          {resultado.erros.length > 0 && (
            <div className="mb-3 space-y-1 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:border dark:border-current dark:bg-red-500/10 dark:text-red-300">
              {resultado.erros.map((erro, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> {erro}
                </div>
              ))}
            </div>
          )}

          {resultado.registros.length > 0 && (
            <>
              <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">Formato detectado: {resultado.formatoDetectado}</p>
              <div className="max-h-96 overflow-auto rounded-lg border border-slate-100 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Carga</th>
                      <th className="px-3 py-2 font-semibold">Destino (Loja)</th>
                      <th className="px-3 py-2 font-semibold">Depósito</th>
                      <th className="px-3 py-2 text-right font-semibold">Peso (kg)</th>
                      <th className="px-3 py-2 text-right font-semibold">Volume (m³)</th>
                      <th className="px-3 py-2 font-semibold">Usuário</th>
                      <th className="px-3 py-2 font-semibold">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.registros.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-3 py-1.5 font-semibold">{r.carga}</td>
                        <td className="px-3 py-1.5">
                          <span className="font-semibold">{r.loja}</span>
                          <span className="text-slate-400 dark:text-slate-500"> — {r.nomeLoja}</span>
                        </td>
                        <td className="px-3 py-1.5">{r.deposito || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{r.peso ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right">{r.volume ?? '—'}</td>
                        <td className="px-3 py-1.5">{r.usuarioGeracao || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-400 dark:text-slate-500">
                          {r.dataGeracaoISO ? formatarDataHora(r.dataGeracaoISO) : r.dataGeracaoBruta || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
