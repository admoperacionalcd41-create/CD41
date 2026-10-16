import React, { useState } from 'react';
import { X, MessageCircle, AlertTriangle, Send, Settings2, SendHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { abrirWhatsapp } from '../../utils/whatsapp';

// Tela genérica de "Notificar equipe" por WhatsApp — usada tanto ao
// concluir um agrupamento (GroupingPage.jsx) quanto ao registrar um
// protocolo de carregamento (LoadingPage.jsx). Recebe a mensagem já pronta
// (ver utils/notificacoes.js) e lista os contatos cadastrados em
// Cadastros > Notificação.
//
// Pedido do usuário: em vez de precisar clicar "Enviar" contato por
// contato, um único botão "Enviar para todos" no topo. IMPORTANTE (e
// avisado na tela, pra não parecer bug): o WhatsApp não tem, em lugar
// nenhum, um jeito de mandar mensagem sozinho sem toque humano — nem pra
// um contato, nem pra um grupo, nem por nenhum site/app de terceiro
// (inclusive este). Todo link de "clique para conversar" (wa.me) só
// preenche o texto; a pessoa ainda precisa apertar Enviar DENTRO do
// WhatsApp, em cada conversa — isso é assim pra qualquer empresa que use
// esse recurso, não é uma limitação só do Doca Manager. O que esse botão
// faz de verdade é abrir a conversa já pronta para todos os contatos de
// uma vez (só falta apertar Enviar dentro de cada uma), em vez de precisar
// voltar aqui pra abrir uma de cada vez.
//
// Isso funciona bem no computador (abre uma aba por contato). No celular é
// mais limitado: ao abrir o link, o aparelho troca para o app do WhatsApp
// na hora — então só a primeira conversa abre, e as outras ficam
// esperando (não dá pra abrir várias ao mesmo tempo nesse caso). Por isso
// o botão individual "Enviar" de cada contato continua existindo embaixo,
// pra repetir ou continuar de onde parou.
export default function NotifyWhatsappModal({ titulo = 'Notificar equipe', mensagem, aoFechar, irPara }) {
  const { state } = useApp();
  const [statusPorTelefone, setStatusPorTelefone] = useState({});

  if (!mensagem) return null;
  const contatos = state.contatosNotificacao || [];

  function aoEnviar(contato) {
    const abriu = abrirWhatsapp(contato.telefone, mensagem);
    setStatusPorTelefone((prev) => ({ ...prev, [contato.telefone]: abriu ? 'ok' : 'bloqueado' }));
  }

  // Dispara a abertura para TODOS os contatos de uma vez, num laço só,
  // sem nenhuma espera (setTimeout/await) entre uma chamada e outra — é
  // isso que mantém as aberturas "coladas" no mesmo clique do usuário, pra
  // o navegador não bloquear como pop-up indesejado (ver abrirWhatsapp,
  // whatsapp.js). Ainda assim, o navegador pode bloquear algumas (comum
  // acontecer com muitos contatos de uma vez, ou no celular) — por isso
  // cada contato continua marcado com seu próprio status abaixo, igual ao
  // envio individual, pra dar pra ver quais abriram e reenviar só as que
  // faltaram.
  function aoEnviarParaTodos() {
    const novoStatus = {};
    contatos.forEach((contato) => {
      novoStatus[contato.telefone] = abrirWhatsapp(contato.telefone, mensagem) ? 'ok' : 'bloqueado';
    });
    setStatusPorTelefone((prev) => ({ ...prev, ...novoStatus }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{titulo}</h3>
          </div>
          <button onClick={aoFechar} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
            {mensagem}
          </div>

          {contatos.length === 0 ? (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300">
              <p className="mb-2">Nenhum contato cadastrado ainda para receber essa notificação.</p>
              {irPara && (
                <button
                  onClick={() => {
                    irPara('cadastros');
                    aoFechar();
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1.5 font-medium text-white hover:bg-amber-700"
                >
                  <Settings2 size={13} /> Cadastrar contatos
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {contatos.length > 1 && (
                <button
                  onClick={aoEnviarParaTodos}
                  className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <SendHorizontal size={15} /> Enviar para todos ({contatos.length})
                </button>
              )}
              {contatos.map((contato) => {
                const status = statusPorTelefone[contato.telefone];
                return (
                  <div
                    key={contato.telefone}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-700"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-medium text-slate-700 dark:text-slate-200">{contato.nome}</span>
                      {status === 'bloqueado' && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={11} /> Não abriu — veja a dica abaixo
                        </span>
                      )}
                      {status === 'ok' && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Aberto no WhatsApp</span>
                      )}
                    </span>
                    <button
                      onClick={() => aoEnviar(contato)}
                      className="flex flex-shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <Send size={13} /> Enviar
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {Object.values(statusPorTelefone).includes('bloqueado') && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                O navegador não deixou abrir o WhatsApp de um ou mais contatos marcados acima. Se
                estiver usando o app pela pré-visualização do claude.ai, isso é esperado — acesse o
                app pelo link hospedado fora dali. Fora disso, costuma acontecer no celular (só abre
                uma conversa por vez) ou quando o navegador bloqueia várias abas de uma vez só —
                toque em "Enviar" individualmente nesses contatos para continuar.
              </span>
            </div>
          )}

          <button
            onClick={aoFechar}
            className="mt-4 w-full rounded-md border border-slate-200 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            {contatos.length === 0 ? 'Fechar' : 'Concluir sem notificar'}
          </button>
        </div>
      </div>
    </div>
  );
}
