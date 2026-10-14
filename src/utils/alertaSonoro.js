// Alerta sonoro (bip) tocado quando uma entrega passa a "Na loja
// (atrasada)" — ver uso em AndamentoEntregasCard.jsx. Gera o som na hora
// com a Web Audio API, sem precisar carregar nenhum arquivo de áudio (fica
// bem mais leve e simples que embutir um .mp3/.wav no projeto).
//
// Mantém um único AudioContext reaproveitado entre os bips (criar um novo
// a cada toque é desperdício e alguns navegadores limitam quantos podem
// existir ao mesmo tempo). Também tenta "acordá-lo" (resume) antes de
// tocar: todo navegador bloqueia áudio automático até o usuário interagir
// pelo menos uma vez com a página (clicar em qualquer lugar já destrava) —
// numa operação normal isso já aconteceu bem antes de qualquer atraso
// acontecer. Numa tela só de monitoramento, sem ninguém tocando nela
// (ex.: TV do pátio — ver comentário em useFullscreen.js), esse bloqueio do
// navegador pode impedir o som de tocar; nesse caso o alerta visual
// (vermelho) continua funcionando normalmente, só o som que não toca.
let audioCtx = null;

function pegarAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

// Um tom curto, com um envelope de volume (sobe e desce suave) em vez de
// ligar/desligar o som de repente — sem o envelope, cada bip vem com um
// "clique" seco e desagradável no início/fim.
function tocarTom(ctx, inicioEm, duracaoS, frequenciaHz) {
  const oscilador = ctx.createOscillator();
  const ganho = ctx.createGain();
  oscilador.type = 'sine';
  oscilador.frequency.value = frequenciaHz;
  ganho.gain.setValueAtTime(0, inicioEm);
  ganho.gain.linearRampToValueAtTime(0.35, inicioEm + 0.015);
  ganho.gain.linearRampToValueAtTime(0, inicioEm + duracaoS);
  oscilador.connect(ganho);
  ganho.connect(ctx.destination);
  oscilador.start(inicioEm);
  oscilador.stop(inicioEm + duracaoS + 0.02);
}

/**
 * Toca o alerta de atraso — dois bips curtos em sequência (mais fácil de
 * notar do que um único tom). Não faz nada (sem travar ou lançar erro) se o
 * navegador não suportar ou se o áudio automático estiver bloqueado.
 */
export function tocarAlertaAtraso() {
  const ctx = pegarAudioContext();
  if (!ctx) return;
  const tocar = () => {
    const agora = ctx.currentTime;
    tocarTom(ctx, agora, 0.18, 880);
    tocarTom(ctx, agora + 0.22, 0.18, 880);
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(tocar).catch(() => {});
  } else {
    tocar();
  }
}
