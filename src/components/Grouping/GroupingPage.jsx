import React, { useState } from 'react';
import GroupingForm from './GroupingForm.jsx';
import GroupingBoard from './GroupingBoard.jsx';
import GroupingHistory from './GroupingHistory.jsx';
import LabelGenerator from './LabelGenerator.jsx';
import StartGroupingModal from './StartGroupingModal.jsx';
import ConcludeGroupingModal from './ConcludeGroupingModal.jsx';
import NotifyWhatsappModal from '../Shared/NotifyWhatsappModal.jsx';
import MoveBoxModal from '../Shared/MoveBoxModal.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { montarMensagemAgrupamento } from '../../utils/notificacoes';

export default function GroupingPage({ irPara }) {
  const { state } = useApp();
  const [lojaEtiquetas, setLojaEtiquetas] = useState(null);
  const [lojaIniciarAgrupamento, setLojaIniciarAgrupamento] = useState(null);
  const [lojaConcluirAgrupamento, setLojaConcluirAgrupamento] = useState(null);
  const [lojaMover, setLojaMover] = useState(null);
  const [mensagemNotificar, setMensagemNotificar] = useState(null);

  // Pedido do usuário: ao confirmar "Concluir Agrupamento" não deve mais
  // abrir nenhuma tela de impressão sozinho (nem o modal de Etiquetas,
  // que tem a pré-visualização + botão Imprimir) — não é viável imprimir
  // pelo celular nesse momento. Vai direto para a notificação da equipe
  // por WhatsApp. O botão manual "Etiquetas" (no quadro/histórico) continua
  // funcionando exatamente como antes, só sob clique explícito (ver
  // aoGerarEtiquetas={setLojaEtiquetas} abaixo).
  function aoConcluirAgrupamento(loja) {
    // Usa sempre a versão mais atual da loja vinda do estado global — o
    // objeto recebido do ConcludeGroupingModal é capturado ANTES da
    // conclusão (quantidade/composição finais ainda não confirmadas).
    const lojaConcluida = state.lojas.find((l) => l.id === loja.id) || loja;
    setMensagemNotificar(montarMensagemAgrupamento(lojaConcluida));
  }

  return (
    <div className="space-y-6">
      <GroupingForm />

      <GroupingBoard
        aoGerarEtiquetas={setLojaEtiquetas}
        aoIniciarAgrupamento={setLojaIniciarAgrupamento}
        aoConcluirAgrupamento={setLojaConcluirAgrupamento}
        aoMoverBox={setLojaMover}
      />

      <GroupingHistory aoGerarEtiquetas={setLojaEtiquetas} aoMoverBox={setLojaMover} />

      {lojaEtiquetas && <LabelGenerator loja={lojaEtiquetas} aoFechar={() => setLojaEtiquetas(null)} />}
      {lojaIniciarAgrupamento && (
        <StartGroupingModal loja={lojaIniciarAgrupamento} aoFechar={() => setLojaIniciarAgrupamento(null)} />
      )}
      {lojaConcluirAgrupamento && (
        <ConcludeGroupingModal
          loja={lojaConcluirAgrupamento}
          aoFechar={() => setLojaConcluirAgrupamento(null)}
          aoConcluir={aoConcluirAgrupamento}
        />
      )}
      {mensagemNotificar && (
        <NotifyWhatsappModal
          titulo="Notificar equipe"
          mensagem={mensagemNotificar}
          aoFechar={() => setMensagemNotificar(null)}
          irPara={irPara}
        />
      )}
      {lojaMover && <MoveBoxModal loja={lojaMover} aoFechar={() => setLojaMover(null)} />}
    </div>
  );
}
