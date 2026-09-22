// Normaliza um telefone digitado de qualquer jeito (com DDD, com/sem 9,
// com parênteses, espaço, traço, +55 etc.) para o formato que o WhatsApp
// espera nos links de clique-para-conversar: só dígitos, com código do
// país na frente (assume Brasil "55" quando a pessoa não digita o código
// do país, que é o caso mais comum aqui).
export function normalizarTelefoneWhatsapp(telefoneDigitado) {
  const somenteDigitos = String(telefoneDigitado || '').replace(/\D/g, '');
  if (!somenteDigitos) return '';

  // Já vem com código do país "55" e tamanho compatível com DDD (2) +
  // número (8 ou 9 dígitos) => 12 ou 13 dígitos no total.
  if (somenteDigitos.startsWith('55') && (somenteDigitos.length === 12 || somenteDigitos.length === 13)) {
    return somenteDigitos;
  }
  // DDD + número, sem código do país (10 ou 11 dígitos) => adiciona "55".
  if (somenteDigitos.length === 10 || somenteDigitos.length === 11) {
    return `55${somenteDigitos}`;
  }
  // Qualquer outro formato (número internacional já completo, etc.): usa
  // como veio, só com os dígitos.
  return somenteDigitos;
}

// Monta o link de "clique para conversar" do WhatsApp com uma mensagem já
// preenchida. Continua exigindo que a pessoa clique em "Enviar" dentro do
// WhatsApp — não existe uma forma de site nenhum enviar mensagem sozinho,
// sem esse passo manual (nem para um contato, nem para um grupo).
export function montarLinkWhatsapp(telefoneDigitado, mensagem) {
  const telefone = normalizarTelefoneWhatsapp(telefoneDigitado);
  const texto = encodeURIComponent(mensagem || '');
  return telefone ? `https://wa.me/${telefone}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

// Abre o link do WhatsApp numa aba nova. Dentro da pré-visualização de
// Artifact do claude.ai isso pode ser bloqueado pelo mesmo motivo que
// afetava a impressão (o sandbox daquele preview não libera abertura de
// abas/janelas) — funciona normalmente assim que o app roda fora desse
// preview (hospedado em outro lugar). Retorna true/false conforme o
// navegador aceitou abrir a aba ou não.
export function abrirWhatsapp(telefoneDigitado, mensagem) {
  const link = montarLinkWhatsapp(telefoneDigitado, mensagem);
  const janela = window.open(link, '_blank', 'noopener,noreferrer');
  return !!janela;
}
