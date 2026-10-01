import { useState } from 'react';
import { eHoje, eEsteMes, eNoMes, mesAtualISO } from '../utils/dateHelpers';

/**
 * Filtro de período compartilhado pelos relatórios que comparam "Hoje" x
 * "Este mês" x um mês escolhido manualmente — ver FiltroPeriodo.jsx para os
 * controles visuais (Permanência, Entregas por Motorista e Produtividade
 * usam este mesmo hook). "escolher" permite ver dados de um mês anterior,
 * não só hoje ou o mês corrente.
 */
export function usePeriodoRelatorio() {
  const [periodo, setPeriodo] = useState('mes'); // 'hoje' | 'mes' | 'escolher'
  // Formato "YYYY-MM" (o mesmo valor que um <input type="month"> usa);
  // começa no mês atual, mas só é considerado quando periodo === 'escolher'.
  const [mesEscolhido, setMesEscolhido] = useState(mesAtualISO());

  function passaPeriodo(dataISO) {
    if (periodo === 'hoje') return eHoje(dataISO);
    if (periodo === 'escolher') return eNoMes(dataISO, mesEscolhido);
    return eEsteMes(dataISO);
  }

  return { periodo, setPeriodo, mesEscolhido, setMesEscolhido, passaPeriodo };
}
