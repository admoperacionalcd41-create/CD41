import { sincronizarBoxes, criarBoxesIniciais } from '../utils/boxLogic';
import { hojeISO } from '../utils/dateHelpers';

// (movido de useSyncedAppState.js pra poder ser usado também na simulação com
// vários usuários — scripts/simulacao-sync — com a normalização REAL do app)
// Garante que qualquer estado vindo de fora (do Supabase — outra pessoa
// pode estar numa versão ligeiramente diferente do app, ou a linha
// compartilhada pode ter sido criada antes de algum campo existir) tenha
// todos os campos que o app espera, com o mesmo valor "vazio" que o
// reducer usa (ver SINCRONIZAR_BOXES/SINCRONIZAR_CADASTROS em
// AppContext.jsx). Sem isso, um campo ausente (ex.: contatosNotificacao)
// quebra a tela com "Cannot read properties of undefined".
export function normalizarEstadoRecebido(dados) {
  if (!dados || typeof dados !== 'object') return dados;
  const placasBrutas = Array.isArray(dados.placasCadastradas) ? dados.placasCadastradas : [];
  const protocolos = Array.isArray(dados.protocolos) ? dados.protocolos : [];
  const lojasBrutas = Array.isArray(dados.lojas) ? dados.lojas : [];
  // `loja.protocolos` é só uma cópia de state.protocolos filtrada pela loja
  // (o app a mantém nas ações, mas nunca a lê) e NÃO é mais sincronizada
  // (ver calcularPatchesEstado.js): aqui é reconstruída a partir da lista
  // oficial, então nunca fica diferente dela.
  const protocolosPorLoja = new Map();
  protocolos.forEach((p) => {
    if (!p || p.lojaId == null) return;
    if (!protocolosPorLoja.has(p.lojaId)) protocolosPorLoja.set(p.lojaId, []);
    protocolosPorLoja.get(p.lojaId).push(p);
  });
  return {
    ...dados,
    lojas: lojasBrutas.map((l) => (l && typeof l === 'object' ? { ...l, protocolos: protocolosPorLoja.get(l.id) || [] } : l)),
    protocolos,
    boxes: sincronizarBoxes(Array.isArray(dados.boxes) ? dados.boxes : criarBoxesIniciais()),
    diaAtual: dados.diaAtual || hojeISO(),
    colaboradoresCadastrados: Array.isArray(dados.colaboradoresCadastrados) ? dados.colaboradoresCadastrados : [],
    motoristasCadastrados: Array.isArray(dados.motoristasCadastrados) ? dados.motoristasCadastrados : [],
    placasCadastradas: placasBrutas.map((p) => (typeof p === 'string' ? { placa: p, possuiPlataforma: false } : p)),
    contatosNotificacao: Array.isArray(dados.contatosNotificacao) ? dados.contatosNotificacao : [],
    localizacaoLojas: Array.isArray(dados.localizacaoLojas) ? dados.localizacaoLojas : [],
    // Observações das lojas (ver AppContext.jsx, DEFINIR_OBSERVACAO_LOJA) —
    // mapa { código da loja: texto }, não um array; mesmo cuidado de
    // normalização dos campos acima, pro caso de chegar aqui uma linha
    // compartilhada salva antes desse campo existir.
    observacoesLoja:
      dados.observacoesLoja && typeof dados.observacoesLoja === 'object' && !Array.isArray(dados.observacoesLoja)
        ? dados.observacoesLoja
        : {},
    // Ordem customizada das lojas (Modo sequência, ver DailyProcessReport.jsx)
    // — mesmo cuidado: estado compartilhado salvo antes desse campo existir
    // não tem essa chave.
    sequenciaLojas: Array.isArray(dados.sequenciaLojas) ? dados.sequenciaLojas : [],
    // Valor pago por palete agrupado (ver ValoresConfigCard.jsx) — mesmo
    // padrão de 0,58 usado em SINCRONIZAR_CADASTROS/mockData.js, pro caso de
    // chegar aqui um estado compartilhado salvo antes desse campo existir.
    valorPaletesAgrupamento: typeof dados.valorPaletesAgrupamento === 'number' ? dados.valorPaletesAgrupamento : 0.58,
  };
}
