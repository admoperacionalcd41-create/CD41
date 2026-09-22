let contador = 0;

/**
 * Gera um identificador único e legível para entidades da aplicação
 * (lojas, protocolos, etc). Não depende de bibliotecas externas.
 */
export function gerarId(prefixo = 'id') {
  contador += 1;
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${prefixo}_${Date.now().toString(36)}_${contador}_${aleatorio}`;
}
