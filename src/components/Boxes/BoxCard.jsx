import React, { useMemo } from 'react';
import { getResumoBox, getStatusBox, boxEhEspecial } from '../../utils/boxLogic';
import { getStatusLoja } from '../../utils/statusStyles';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';
import { useApp } from '../../context/AppContext.jsx';

export default function BoxCard({ box, lojasPorId, aoSelecionarLoja }) {
  const { filtroTipoCarga } = useApp();
  // A ocupação física (vagas coloridas/contagem) continua contando TODAS as
  // lojas do box — só a lista de lojas detalhada abaixo é filtrada, para não
  // fazer um box parecer "com vaga livre" quando na verdade está ocupado por
  // uma carga do outro tipo.
  const resumo = useMemo(() => getResumoBox(box, lojasPorId), [box, lojasPorId]);
  const statusBox = useMemo(() => getStatusBox(box, lojasPorId), [box, lojasPorId]);
  const especial = boxEhEspecial(box.nome);
  // Boxes bem maiores que o padrão (BLOCADO 1/2, com 36/42 vagas) usam mais
  // colunas na grade de vagas — senão ficam com linhas demais e o card
  // acaba bem mais alto que os vizinhos, empurrando o resto da tela pra
  // baixo (ex.: o card de Andamento das Entregas, logo abaixo da grade).
  const vagasGridClasse = resumo.totalVagas > 30 ? 'grid-cols-12' : 'grid-cols-9';
  const lojasIdsFiltradas = useMemo(
    () => resumo.lojasIds.filter((id) => lojaPassaFiltroTipoCarga(lojasPorId[id], filtroTipoCarga)),
    [resumo.lojasIds, lojasPorId, filtroTipoCarga]
  );

  return (
    <div
      className={`flex flex-col rounded-lg border p-3 shadow-sm ${
        especial
          ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-1.5">
        <h3
          title={box.nome}
          className={`truncate font-mono text-xs font-bold ${especial ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}
        >
          {box.nome}
        </h3>
        {/* Um ponto colorido no lugar do texto do status (ex.: "Disponível")
            deixa mais espaço pro nome do box não ser cortado quando a grade
            tem mais colunas — o texto completo continua acessível ao passar
            o mouse (title/aria-label). */}
        <span
          className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${statusBox.corSolida}`}
          title={statusBox.texto}
          aria-label={statusBox.texto}
        />
      </div>
      <p className="mb-1.5 truncate text-[10px] text-slate-400 dark:text-slate-500" title={statusBox.texto}>
        {statusBox.texto} • {resumo.disponiveis} livre{resumo.disponiveis !== 1 ? 's' : ''} de {resumo.totalVagas}
      </p>

      <div className={`grid ${vagasGridClasse} gap-0.5`}>
        {box.vagas
          .slice()
          .sort((a, b) => a.numero - b.numero)
          .map((vaga) => {
            const loja = vaga.lojaId ? lojasPorId[vaga.lojaId] : null;
            const statusVaga = loja ? getStatusLoja(loja.status) : null;
            return (
              <button
                key={vaga.numero}
                title={
                  loja
                    ? `Vaga ${vaga.numero} — Loja ${loja.loja} (${loja.nomeLoja}) — ${statusVaga.texto}`
                    : `Vaga ${vaga.numero} — livre`
                }
                onClick={() => loja && aoSelecionarLoja && aoSelecionarLoja(loja)}
                className={`flex aspect-square items-center justify-center rounded text-[8px] font-semibold text-white ${
                  vaga.ocupada ? statusVaga.corSolida : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                } ${loja ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                {vaga.numero}
              </button>
            );
          })}
      </div>

      {/* Lojas do box como chips compactos (em vez do bloco detalhado de
          antes) — mantém o card curto o bastante pra caber vários boxes na
          tela sem rolar; clicar num chip abre o mesmo modal de detalhes. */}
      {lojasIdsFiltradas.length > 0 && (
        <div
          className={`mt-2 flex flex-wrap gap-1 border-t pt-2 ${
            especial ? 'border-rose-100 dark:border-rose-900/50' : 'border-slate-100 dark:border-slate-700'
          }`}
        >
          {lojasIdsFiltradas.map((lojaId) => {
            const loja = lojasPorId[lojaId];
            if (!loja) return null;
            const status = getStatusLoja(loja.status);
            return (
              <button
                key={lojaId}
                onClick={() => aoSelecionarLoja && aoSelecionarLoja(loja)}
                title={`Loja ${loja.loja} — ${loja.nomeLoja} — ${status.texto} — ${loja.paletesAgrupados} palete${loja.paletesAgrupados !== 1 ? 's' : ''}`}
                className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${status.corPonto}`} />
                {loja.loja}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
