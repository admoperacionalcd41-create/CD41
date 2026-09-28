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
  const lojasIdsFiltradas = useMemo(
    () => resumo.lojasIds.filter((id) => lojaPassaFiltroTipoCarga(lojasPorId[id], filtroTipoCarga)),
    [resumo.lojasIds, lojasPorId, filtroTipoCarga]
  );

  // Grade de vagas HORIZONTAL SEQUENCIADA (não ímpar/par): preenche linha por
  // linha, da esquerda pra direita, até um número FIXO de colunas — em vez de
  // sempre dividir em exatamente 2 linhas (o que deixava boxes com poucas
  // vagas bem estreitos e os BLOCADO/Box Frios bem largos, com cards de
  // larguras muito diferentes). Como agora o card inteiro ocupa a largura da
  // coluna da grade (ver BoxGrid — todos os boxes em duas linhas, largura
  // igual pra cada card), o limite de colunas de vagas pode ser mais baixo
  // (6) sem afetar a largura do card: as células de vaga é que se esticam
  // (1fr) pra preencher a largura disponível, então todo card fica com a
  // MESMA largura entre si (o mesmo tamanho de coluna da grade), variando só
  // a altura conforme o número de linhas de vaga.
  const COLUNAS_MAX = 6;
  const colunas = Math.min(box.totalVagas, COLUNAS_MAX);
  const linhas = Math.ceil(box.totalVagas / colunas);

  return (
    <div
      className={`flex w-full min-w-0 flex-col rounded-lg border p-2 shadow-sm ${
        especial
          ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3
          title={box.nome}
          className={`truncate font-mono text-sm font-bold leading-tight ${especial ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}
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
      <p className="mb-1 truncate text-[11px] leading-tight text-slate-400 dark:text-slate-500" title={statusBox.texto}>
        {statusBox.texto} • {resumo.disponiveis} livre{resumo.disponiveis !== 1 ? 's' : ''} de {resumo.totalVagas}
      </p>

      {/* Vagas em linhas HORIZONTAIS SEQUENCIADAS (não ímpar/par): preenche
          linha por linha, da esquerda pra direita — o comportamento padrão
          de uma grade CSS — até no máximo `colunas` (6) por linha, com
          `linhas` linhas explícitas pra caber todas as vagas do box. Precisa
          ser inline porque colunas/linhas variam por box (6x5 num box de 26
          vagas, 6x7 no BLOCADO 2 de 42...) e uma classe Tailwind não daria
          conta de um valor dinâmico. Colunas em `1fr` (em vez de um valor em
          px fixo) pra esticar e preencher a largura real do card — que agora
          é definida pela grade de boxes (ver BoxGrid), não pelo conteúdo —
          só a altura da célula é fixa, pra manter as vagas com uma proporção
          legível mesmo quando esticadas. */}
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${linhas}, 22px)`,
        }}
      >
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
                className={`flex items-center justify-center rounded text-xs font-semibold leading-none text-white ${
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
          className={`mt-1.5 flex flex-wrap gap-1.5 border-t pt-1.5 ${
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
                className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${status.corPonto}`} />
                {loja.loja}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
