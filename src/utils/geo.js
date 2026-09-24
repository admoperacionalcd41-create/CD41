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

// Monta um endereço curto (rua, número - bairro - cidade) a partir da
// resposta de geocodificação reversa do Nominatim (OpenStreetMap) — usado
// no lugar de coordenadas cruas no registro de chegada/saída do motorista
// (ver DriversPage.jsx). Cai pro `display_name` completo quando os campos
// estruturados de endereço vêm incompletos.
function formatarEnderecoNominatim(dados) {
  const endereco = dados?.address || {};
  const rua = [
    endereco.road || endereco.pedestrian || endereco.footway || endereco.residential,
    endereco.house_number,
  ]
    .filter(Boolean)
    .join(', ');
  const bairro = endereco.suburb || endereco.neighbourhood || endereco.city_district;
  const cidade = endereco.city || endereco.town || endereco.village || endereco.municipality;
  const partes = [rua, bairro, cidade].filter(Boolean);
  if (partes.length > 0) return partes.join(' - ');
  return dados?.display_name || null;
}

/**
 * Busca o endereço da rua a partir de uma coordenada (geocodificação
 * reversa), usando a API pública e gratuita do Nominatim/OpenStreetMap —
 * não precisa de chave de API. Nunca lança erro: sem internet (ex.: a
 * prévia interativa publicada como artifact, que bloqueia chamadas de rede
 * externas), serviço fora do ar ou demora demais, retorna `null` — o
 * chamador cai de volta para exibir as coordenadas cruas, sem travar o
 * registro de chegada/saída por causa disso.
 */
export async function buscarEnderecoPorCoordenada(latitude, longitude) {
  try {
    const controlador = new AbortController();
    const timeoutId = setTimeout(() => controlador.abort(), 6000);
    const resposta = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      { signal: controlador.signal, headers: { Accept: 'application/json' } }
    );
    clearTimeout(timeoutId);
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    return formatarEnderecoNominatim(dados);
  } catch {
    return null;
  }
}
