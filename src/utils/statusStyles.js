// ---------------------------------------------------------------------------
// Padrão único de cores por status da loja, usado em todas as telas
// (Boxes/Vagas, Agrupamento, Carregamento) para que uma mesma loja seja
// sempre identificada pela mesma cor, e para que se possa diferenciar de
// relance uma loja "Em Execução" (apontada) de uma loja já "Agrupada" (ou
// além) — inclusive dentro do mesmo box, entre vagas de lojas diferentes.
//
// `corBadge` segue o mesmo padrão em todo o app: preenchimento suave no modo
// claro (bg-X-50/texto-X-600), e no modo escuro um contorno fino na cor do
// texto sobre um fundo quase transparente (em vez de uma chapa colorida) —
// é o que dá a leitura de "etiqueta técnica" do painel escuro, mantendo o
// claro como já era.
// ---------------------------------------------------------------------------

export const STATUS_LOJA = {
  apontada: {
    texto: 'Em Execução',
    corBadge: 'bg-amber-50 text-amber-600 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300',
    corSolida: 'bg-amber-500',
    corPonto: 'bg-amber-500',
    corBorda: 'border-amber-400 dark:border-amber-500',
  },
  conferencia_finalizada: {
    texto: 'Conferência Finalizada',
    corBadge: 'bg-teal-50 text-teal-600 dark:border dark:border-current dark:bg-teal-500/10 dark:text-teal-300',
    corSolida: 'bg-teal-500',
    corPonto: 'bg-teal-500',
    corBorda: 'border-teal-400 dark:border-teal-500',
  },
  em_agrupamento: {
    texto: 'Agrupando',
    corBadge: 'bg-indigo-50 text-indigo-600 dark:border dark:border-current dark:bg-indigo-500/10 dark:text-indigo-300',
    corSolida: 'bg-indigo-500',
    corPonto: 'bg-indigo-500',
    corBorda: 'border-indigo-400 dark:border-indigo-500',
  },
  agrupada: {
    texto: 'Agrupada',
    corBadge: 'bg-blue-50 text-blue-600 dark:border dark:border-current dark:bg-blue-500/10 dark:text-blue-300',
    corSolida: 'bg-blue-500',
    corPonto: 'bg-blue-500',
    corBorda: 'border-blue-400 dark:border-blue-500',
  },
  carregando: {
    texto: 'Em carregamento',
    corBadge: 'bg-purple-50 text-purple-600 dark:border dark:border-current dark:bg-purple-500/10 dark:text-purple-300',
    corSolida: 'bg-purple-500',
    corPonto: 'bg-purple-500',
    corBorda: 'border-purple-400 dark:border-purple-500',
  },
  finalizada: {
    texto: 'Finalizada',
    corBadge: 'bg-emerald-50 text-emerald-600 dark:border dark:border-current dark:bg-emerald-500/10 dark:text-emerald-300',
    corSolida: 'bg-emerald-500',
    corPonto: 'bg-emerald-500',
    corBorda: 'border-emerald-400 dark:border-emerald-500',
  },
  pendente: {
    texto: 'Pendente',
    corBadge: 'bg-slate-100 text-slate-500 dark:border dark:border-slate-600 dark:bg-transparent dark:text-slate-400',
    corSolida: 'bg-slate-300 dark:bg-slate-600',
    corPonto: 'bg-slate-300 dark:bg-slate-600',
    corBorda: 'border-slate-300 dark:border-slate-600',
  },
};

const PADRAO = {
  texto: '—',
  corBadge: 'bg-slate-100 text-slate-500 dark:border dark:border-slate-600 dark:bg-transparent dark:text-slate-400',
  corSolida: 'bg-slate-300 dark:bg-slate-600',
  corPonto: 'bg-slate-300 dark:bg-slate-600',
  corBorda: 'border-slate-300 dark:border-slate-600',
};

export function getStatusLoja(status) {
  return STATUS_LOJA[status] || PADRAO;
}
