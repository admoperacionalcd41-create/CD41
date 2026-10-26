// `__APP_VERSION__`/`__APP_BUILD_DATE__` são injetados em tempo de BUILD
// (ver vite.config.js — substituição textual, não variável de ambiente em
// runtime) com o hash curto do commit e a data/hora do build. Isolados aqui
// num módulo só pra nenhum outro arquivo precisar referenciar esses globais
// "mágicos" diretamente.
//
// Pedido do usuário: mostrar isso em algum lugar da tela de Box / Frota —
// um problema relatado em produção (Box 9 não mostrando as 32 vagas) acabou
// sendo o deploy ainda não ter aquela atualização, e não tinha como
// confirmar isso só olhando a tela. Com a versão visível, basta comparar
// com o commit mais recente entregue pra saber se o deploy em uso já é o
// mais novo.
export function getVersaoApp() {
  // eslint-disable-next-line no-undef
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
}

export function getDataBuildApp() {
  // eslint-disable-next-line no-undef
  return typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : null;
}

// Formata a data/hora do build no padrão pt-BR, curto (ex.: "24/10 13:58"),
// o bastante pra diferenciar duas versões no mesmo dia sem poluir a tela.
export function getVersaoFormatada() {
  const versao = getVersaoApp();
  const dataBuild = getDataBuildApp();
  if (!dataBuild) return `v${versao}`;
  try {
    const data = new Date(dataBuild);
    const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `v${versao} · ${dataFormatada} ${horaFormatada}`;
  } catch {
    return `v${versao}`;
  }
}
