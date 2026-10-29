// ---------------------------------------------------------------------------
// Aplica no CLIENTE a mesma lista de patches que o banco aplica em
// app_state_aplicar_patches (supabase/schema.sql) — espelho exato, op por op.
//
// Pedido do usuário ("atingindo o limite do Supabase, como manter grátis?"):
// o Realtime mandava o documento inteiro (~300 kB) a cada usuário a cada
// ação — ~41 GB num mês contra os 5 GB do plano gratuito. Agora o Realtime
// manda só os patches (alguns kB, tabela app_state_log) e cada aparelho os
// aplica sobre o último estado do servidor que conhece, chegando ao MESMO
// documento que o banco tem. Por isso este arquivo precisa se comportar
// igual ao SQL: o teste de equivalência (scripts/simulacao-sync) compara
// os dois com patches aleatórios, e a simulação com vários usuários confere
// que a tela de cada um termina igual ao banco.
//
// Não altera o estado recebido (a tela e a `base` compartilham objetos):
// devolve cópias só das partes que mudaram. Lança erro se um patch não
// puder ser aplicado (quem chama então relê o documento do servidor).
// ---------------------------------------------------------------------------

// Mesmo critério do SQL: `elem->>chave = valorChave` (comparação como texto;
// valor ausente/null nunca casa).
function achaIndice(colecao, chave, valorChave) {
  return colecao.findIndex((elem) => {
    const v = elem && typeof elem === 'object' ? elem[chave] : undefined;
    return v !== undefined && v !== null && String(v) === String(valorChave);
  });
}

const comoLista = (v) => (Array.isArray(v) ? v : []);
const comoMapa = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const texto = (v) => (v === undefined || v === null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function aplicarPatchesEstado(estado, patches) {
  if (!Array.isArray(patches)) throw new Error('patches inválidos');
  const dados = { ...estado };

  patches.forEach((patch) => {
    switch (patch?.op) {
      case 'upsert_item': {
        const lista = comoLista(dados[patch.colecao]);
        const i = achaIndice(lista, patch.chave, patch.valorChave);
        dados[patch.colecao] = i < 0 ? [...lista, patch.item] : lista.map((x, k) => (k === i ? patch.item : x));
        break;
      }
      case 'mesclar_item': {
        const lista = comoLista(dados[patch.colecao]);
        const i = achaIndice(lista, patch.chave, patch.valorChave);
        if (i < 0) break; // item excluído por outra pessoa: respeita (igual ao SQL)
        const item = { ...lista[i], ...(patch.campos || {}) };
        if (Array.isArray(patch.removidos)) patch.removidos.forEach((campo) => delete item[campo]);
        dados[patch.colecao] = lista.map((x, k) => (k === i ? item : x));
        break;
      }
      case 'remover_item': {
        const lista = comoLista(dados[patch.colecao]);
        dados[patch.colecao] = lista.filter((elem) => {
          const v = elem && typeof elem === 'object' ? elem[patch.chave] : undefined;
          const casa = v !== undefined && v !== null && String(v) === String(patch.valorChave);
          return !casa;
        });
        break;
      }
      case 'upsert_vaga': {
        const boxes = comoLista(dados.boxes);
        const ib = boxes.findIndex((b) => b && Number(b.numero) === Number(patch.numeroBox));
        if (ib < 0) throw new Error(`upsert_vaga: box ${patch.numeroBox} não encontrado`);
        const vagas = comoLista(boxes[ib].vagas);
        const iv = vagas.findIndex((v) => v && Number(v.numero) === Number(patch.vaga?.numero));
        const novasVagas = iv < 0 ? [...vagas, patch.vaga] : vagas.map((v, k) => (k === iv ? patch.vaga : v));
        dados.boxes = boxes.map((b, k) => (k === ib ? { ...b, vagas: novasVagas } : b));
        break;
      }
      case 'definir_escalar':
        dados[patch.campo] = patch.valor === undefined ? null : patch.valor;
        break;
      case 'definir_mapa':
        dados[patch.campo] = { ...comoMapa(dados[patch.campo]), [patch.chave]: patch.valor === undefined ? null : patch.valor };
        break;
      case 'remover_mapa': {
        const mapa = { ...comoMapa(dados[patch.campo]) };
        delete mapa[patch.chave];
        dados[patch.campo] = mapa;
        break;
      }
      case 'adicionar_simples': {
        const lista = comoLista(dados[patch.campo]);
        dados[patch.campo] = lista.some((t) => texto(t) === texto(patch.valor)) ? lista : [...lista, patch.valor];
        break;
      }
      case 'remover_simples': {
        const lista = comoLista(dados[patch.campo]);
        dados[patch.campo] = lista.filter((t) => texto(t) !== texto(patch.valor));
        break;
      }
      default:
        throw new Error(`patch com op desconhecida: ${patch?.op}`);
    }
  });

  return dados;
}
