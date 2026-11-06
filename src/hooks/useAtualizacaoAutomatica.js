// ---------------------------------------------------------------------------
// Atualização automática do app em todos os aparelhos.
//
// Pedido do usuário: "é possível que, ao fazer a atualização, os aparelhos
// sejam atualizados sem precisar ir atrás de cada usuário?"
//
// Antes, quem já estava com o app aberto (celular na doca, PC da expedição,
// app instalado) continuava rodando o código antigo até alguém fechar e
// abrir de novo. Agora cada aparelho consulta /version.json (arquivo minúsculo
// gerado a cada build, ver vite.config.js) quando abre, a cada poucos minutos
// e sempre que volta ao primeiro plano. Se a versão publicada for diferente
// da que está rodando, o aparelho pede ao navegador a versão nova, avisa na
// tela ("atualizando em alguns segundos") e recarrega sozinho.
//
// Proteções:
// - só atua no site publicado (build de produção com versão conhecida);
// - nunca recarrega em laço: no máximo 2 tentativas por versão nova — a 2ª
//   limpa o cache do app e o service worker antes de recarregar;
// - falha de rede ao consultar a versão é ignorada (tenta de novo depois).
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react';
import { getVersaoApp } from '../utils/appVersion';

export const INTERVALO_CONSULTA_MS = 5 * 60 * 1000;
export const PRIMEIRA_CONSULTA_MS = 15 * 1000;
export const CONTAGEM_REGRESSIVA_S = 15;
const MAX_TENTATIVAS = 2;
const CHAVE_TENTATIVAS = 'doca-atualizacao-tentativas';

// Pura (testável): há versão nova publicada?
export function haVersaoNova(versaoLocal, versaoRemota) {
  if (!versaoLocal || !versaoRemota) return false;
  if (versaoLocal === 'dev' || versaoLocal === 'sem-git') return false;
  if (versaoRemota === 'dev' || versaoRemota === 'sem-git') return false;
  return String(versaoLocal) !== String(versaoRemota);
}

function lerTentativas() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_TENTATIVAS) || '{}');
  } catch {
    return {};
  }
}
function gravarTentativas(obj) {
  try {
    sessionStorage.setItem(CHAVE_TENTATIVAS, JSON.stringify(obj));
  } catch {
    /* sem sessionStorage: segue sem contar */
  }
}

async function consultarVersaoPublicada() {
  const resp = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!resp.ok) return null;
  const dados = await resp.json();
  return typeof dados?.versao === 'string' ? dados.versao : null;
}

async function pedirVersaoNovaAoNavegador(limparTudo) {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (limparTudo) {
        await Promise.all(regs.map((r) => r.unregister()));
      } else {
        // Ativa o service worker novo (skipWaiting/clientsClaim já estão
        // ligados — ver vite.config.js) com um limite de espera.
        await Promise.race([Promise.all(regs.map((r) => r.update())), new Promise((ok) => setTimeout(ok, 8000))]);
      }
    }
    if (limparTudo && typeof caches !== 'undefined') {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((n) => caches.delete(n)));
    }
  } catch {
    /* melhor esforço: o recarregamento abaixo ainda busca o index.html novo */
  }
}

export function useAtualizacaoAutomatica() {
  const [segundosRestantes, setSegundosRestantes] = useState(null); // null = nada a fazer
  const versaoNovaRef = useRef(null);
  const ativoRef = useRef(true);

  const recarregar = useCallback(async () => {
    const versaoNova = versaoNovaRef.current;
    const tentativas = lerTentativas();
    const feitas = tentativas[versaoNova] || 0;
    if (feitas >= MAX_TENTATIVAS) {
      setSegundosRestantes(null);
      return;
    }
    gravarTentativas({ ...tentativas, [versaoNova]: feitas + 1 });
    await pedirVersaoNovaAoNavegador(feitas >= 1);
    window.location.reload();
  }, []);

  const verificar = useCallback(async () => {
    if (!import.meta.env.PROD || versaoNovaRef.current) return;
    const local = getVersaoApp();
    if (local === 'dev' || local === 'sem-git') return;
    try {
      const remota = await consultarVersaoPublicada();
      if (!ativoRef.current || !haVersaoNova(local, remota)) return;
      if ((lerTentativas()[remota] || 0) >= MAX_TENTATIVAS) return; // já tentou: não insiste
      versaoNovaRef.current = remota;
      setSegundosRestantes(CONTAGEM_REGRESSIVA_S);
    } catch {
      /* sem rede agora: tenta na próxima */
    }
  }, []);

  // Consultas: logo depois de abrir, periódica, ao voltar à tela e ao reconectar.
  useEffect(() => {
    ativoRef.current = true;
    const primeira = setTimeout(verificar, PRIMEIRA_CONSULTA_MS);
    const periodica = setInterval(verificar, INTERVALO_CONSULTA_MS);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') verificar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', verificar);
    return () => {
      ativoRef.current = false;
      clearTimeout(primeira);
      clearInterval(periodica);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', verificar);
    };
  }, [verificar]);

  // Contagem regressiva até recarregar.
  useEffect(() => {
    if (segundosRestantes === null) return undefined;
    if (segundosRestantes <= 0) {
      recarregar();
      return undefined;
    }
    const t = setTimeout(() => setSegundosRestantes((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [segundosRestantes, recarregar]);

  return { segundosRestantes, atualizarAgora: () => setSegundosRestantes(0) };
}
