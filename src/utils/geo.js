// Ajuda pra automatizar (com confirmação) o registro de chegada do
// motorista na loja: compara a posição atual do celular (GPS do navegador)
// com a coordenada cadastrada da loja (ver Cadastros > Localização das
// Lojas) e considera "chegou" quando está dentro do raio abaixo.
export const RAIO_GEOFENCE_METROS = 300;

/**
 * Distância em metros entre duas coordenadas (fórmula de Haversine) —
 * precisão de sobra pra geofence de loja, sem precisar de nenhuma
 * biblioteca externa.
 */
export function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000; // raio médio da Terra, em metros
  const toRad = (graus) => (graus * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Formata uma distância em metros como "180 m" ou "3,4 km". */
export function formatarDistancia(metros) {
  if (metros == null || Number.isNaN(metros)) return '—';
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}
