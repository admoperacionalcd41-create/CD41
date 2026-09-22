// ---------------------------------------------------------------------------
// Tipo de carga (Seca / Resfriada) — separação informativa entre as duas
// operações do CD. O campo é definido uma vez, no momento da importação
// (todas as lojas coladas num mesmo lote entram com o mesmo tipo, já que a
// planilha de origem não carrega essa informação), e a partir daí acompanha
// a loja por todas as telas do sistema (board de agrupamento, boxes,
// etiquetas, protocolo de carregamento, relatórios etc.), só como etiqueta
// visual — não restringe em quais boxes a loja pode ser alocada.
// ---------------------------------------------------------------------------

export const TIPOS_CARGA = [
  {
    chave: 'seca',
    texto: 'Seca',
    corBadge: 'bg-orange-50 text-orange-700 dark:border dark:border-current dark:bg-orange-500/10 dark:text-orange-300',
    corPonto: 'bg-orange-500',
  },
  {
    chave: 'resfriada',
    texto: 'Resfriada',
    corBadge: 'bg-cyan-50 text-cyan-700 dark:border dark:border-current dark:bg-cyan-500/10 dark:text-cyan-300',
    corPonto: 'bg-cyan-500',
  },
];

const TIPO_PADRAO = TIPOS_CARGA[0];

export function getTipoCarga(chave) {
  return TIPOS_CARGA.find((t) => t.chave === chave) || TIPO_PADRAO;
}

// Usado pelo filtro global (seletor no cabeçalho, ver Header.jsx) em todas
// as telas que listam lojas: 'todos' deixa tudo passar; 'seca'/'resfriada'
// só deixam passar lojas daquele tipo (lojas sem tipoCarga definido contam
// como 'seca', o padrão do sistema).
export function lojaPassaFiltroTipoCarga(loja, filtro) {
  if (!filtro || filtro === 'todos') return true;
  return (loja?.tipoCarga || 'seca') === filtro;
}
