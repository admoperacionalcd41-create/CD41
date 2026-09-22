import React, { useState } from 'react';
import { X, MessageCircle, AlertTriangle, Send, Settings2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { abrirWhatsapp } from '../../utils/whatsapp';

// Tela genérica de "Notificar equipe" por WhatsApp — usada tanto ao
// concluir um agrupamento (GroupingPage.jsx) quanto ao registrar um
// protocolo de carregamento (LoadingPage.jsx). Recebe a mensagem já pronta
// (ver utils/notificacoes.js) e lista os contatos cadastrados em
// Cadastros > Notificação, cada um com seu próprio botão "Enviar". Cada
// envio é um clique manual — o WhatsApp não tem um jeito de mandar sozinho,
// nem pra um contato nem pra um grupo.
export default function NotifyWhatsappModal({ titulo = 'Notificar equipe', mensagem, aoFechar, irPara }) {
  const { state } = useApp();
  const [statusPorTelefone, setStatusPorTelefone] = useState({});

  if (!mensagem) return null;
  const contatos = state.contatosNotificacao || [];

  function aoEnviar(contato) {
    const abriu = abrirWhatsapp(contato.telefone, mensagem);
    setStatusPorTelefone((prev) => ({ ...prev, [contato.telefone]: abriu ? 'ok' : 'bloqueado' }));
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
                O navegador não deixou abrir o WhatsApp. Se estiver usando o app pela
                pré-visualização do claude.ai, isso é esperado — acesse o app pelo link hospedado
                fora dali para essa abertura funcionar direto.
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
