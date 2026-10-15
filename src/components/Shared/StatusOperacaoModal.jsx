import React, { useState } from 'react';
import { X, MessageCircle, Send, AlertTriangle } from 'lucide-react';
import { abrirWhatsapp } from '../../utils/whatsapp';

// Modal do botão "Status por WhatsApp" (ver ResumoProcessoCard.jsx, aba
// Box / Frota — tela inicial do app). Diferente de NotifyWhatsappModal.jsx
// (que lista contatos cadastrados, cada um com seu botão "Enviar"), esta
// mensagem não tem destino fixo — pedido do usuário: abrir o WhatsApp já
// com o texto pronto e deixar a pessoa escolher na hora pra quem mandar
// (contato ou grupo), usando o fallback wa.me/?text=... que whatsapp.js já
// suporta sem telefone nenhum.
export default function StatusOperacaoModal({ mensagemEnxuta, mensagemDetalhada, aoFechar }) {
  const [detalhado, setDetalhado] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const mensagem = detalhado ? mensagemDetalhada : mensagemEnxuta;

  function aoAbrir() {
    const abriu = abrirWhatsapp(null, mensagem);
    setBloqueado(!abriu);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Status da operação</h3>
          </div>
          <button
            onClick={aoFechar}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-3 flex gap-2 text-xs">
            <button
              onClick={() => setDetalhado(false)}
              className={`flex-1 rounded-md border px-2.5 py-1.5 font-medium ${
                !detalhado
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              Resumida
            </button>
            <button
              onClick={() => setDetalhado(true)}
              className={`flex-1 rounded-md border px-2.5 py-1.5 font-medium ${
                detalhado
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              Detalhada
            </button>
          </div>

          <div className="mb-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
            {mensagem}
          </div>

          {bloqueado && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                O navegador não deixou abrir o WhatsApp. Se estiver usando o app pela
                pré-visualização do claude.ai, isso é esperado — acesse o app pelo link hospedado
                fora dali para essa abertura funcionar direto.
              </span>
            </div>
          )}

          <button
            onClick={aoAbrir}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Send size={14} /> Abrir WhatsApp
          </button>

          <button
            onClick={aoFechar}
            className="mt-2 w-full rounded-md border border-slate-200 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
