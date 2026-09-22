/** Retorna a data de hoje no formato YYYY-MM-DD (chave de referência de dia). */
export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Soma (ou subtrai) dias a uma data no formato YYYY-MM-DD. */
export function somarDias(dataISO, dias) {
  const data = new Date(`${dataISO}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function formatarDataHora(isoCompleto) {
  if (!isoCompleto) return '—';
  const data = new Date(isoCompleto);
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Formata apenas o horário (HH:mm) de um timestamp ISO completo. */
export function formatarHora(isoCompleto) {
  if (!isoCompleto) return '—';
  const data = new Date(isoCompleto);
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formata um timestamp ISO completo (ou "agora", se omitido) no formato
 * "YYYY-MM-DDTHH:mm" exigido pelo valor de um <input type="datetime-local">
 * — usado para registrar manualmente uma chegada/saída que o motorista
 * esqueceu de sinalizar na hora certa. Trabalha sempre em horário local
 * (nunca UTC), que é o que o input exibe e o que o usuário digita.
 */
export function paraDataHoraLocalInput(isoCompleto) {
  const data = isoCompleto ? new Date(isoCompleto) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

/**
 * Converte o valor de um <input type="datetime-local"> (string local, sem
 * timezone) de volta para um timestamp ISO completo em UTC, do mesmo jeito
 * que o resto do app armazena datas.
 */
export function deDataHoraLocalInput(valorInput) {
  if (!valorInput) return null;
  return new Date(valorInput).toISOString();
}

/** Formata uma duração em milissegundos como "Xh Ymin" (ou só "Ymin" se < 1h). */
export function formatarDuracao(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '—';
  const totalMinutos = Math.round(ms / 60000);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas === 0) return `${minutos} min`;
  return `${horas}h ${minutos}min`;
}

export function formatarData(dataISO) {
  if (!dataISO) return '—';
  const data = new Date(`${dataISO}T00:00:00`);
  return data.toLocaleDateString('pt-BR');
}

/** Verifica se um timestamp ISO completo corresponde ao dia de hoje (relógio real). */
export function eHoje(isoCompleto) {
  if (!isoCompleto) return false;
  return isoCompleto.slice(0, 10) === hojeISO();
}

/** Retorna o mês atual no formato YYYY-MM (relógio real). */
export function mesAtualISO() {
  return new Date().toISOString().slice(0, 7);
}

/** Verifica se um timestamp ISO completo cai no mês atual (relógio real). */
export function eEsteMes(isoCompleto) {
  if (!isoCompleto) return false;
  return isoCompleto.slice(0, 7) === mesAtualISO();
}

const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Nome curto do dia da semana (Seg, Ter, ...) a partir de uma data YYYY-MM-DD. */
export function formatarDiaSemanaCurto(dataISO) {
  const data = new Date(`${dataISO}T00:00:00`);
  return DIAS_SEMANA_ABREV[data.getDay()];
}

/**
 * Datas (YYYY-MM-DD) de segunda a sexta-feira da semana corrente (relógio
 * real), usadas no relatório de meta diária. Independe do dia operacional
 * do sistema (state.diaAtual) — é sempre a semana civil de verdade, para o
 * relatório fazer sentido pra quem só olha o calendário.
 */
export function getDiasUteisSemanaAtual() {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=domingo, 1=segunda, ..., 6=sábado
  const deltaParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() + deltaParaSegunda);

  const dias = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(segunda);
    d.setDate(segunda.getDate() + i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}
