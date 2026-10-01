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
  // Id da loja recém-concluída, enquanto o modal de etiquetas (aberto
  // automaticamente logo após "Concluir Agrupamento") está na tela — ao
  // fechar esse modal (depois de imprimir), abre em seguida a notificação
  // da equipe por WhatsApp dessa mesma loja. Fica null no fluxo avulso de
  // "Etiquetas" (clicado direto no quadro/histórico), que não deve abrir o
  // WhatsApp ao fechar.
  const [lojaIdAposAgrupamento, setLojaIdAposAgrupamento] = useState(null);

  // Usa sempre a versão mais atual da loja vinda do estado global — o
  // objeto recebido de ConcludeGroupingModal é capturado ANTES da
  // conclusão (quantidade/composição finais ainda não confirmadas), então
  // ler direto de `state.lojas` aqui garante que a etiqueta mostre a
  // quantidade de paletes e a composição que acabaram de ser informadas,
  // não o valor antigo (estimado no apontamento).
  const lojaParaEtiquetas = lojaIdAposAgrupamento
    ? state.lojas.find((l) => l.id === lojaIdAposAgrupamento) || lojaEtiquetas
    : lojaEtiquetas;

  function abrirEtiquetasAposConcluir(loja) {
    setLojaIdAposAgrupamento(loja.id);
    setLojaEtiquetas(loja);
  }

  function fecharEtiquetas() {
    setLojaEtiquetas(null);
    if (lojaIdAposAgrupamento) {
      const lojaConcluida = state.lojas.find((l) => l.id === lojaIdAposAgrupamento);
      if (lojaConcluida) setMensagemNotificar(montarMensagemAgrupamento(lojaConcluida));
      setLojaIdAposAgrupamento(null);
    }
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

      {lojaParaEtiquetas && <LabelGenerator loja={lojaParaEtiquetas} aoFechar={fecharEtiquetas} />}
      {lojaIniciarAgrupamento && (
        <StartGroupingModal loja={lojaIniciarAgrupamento} aoFechar={() => setLojaIniciarAgrupamento(null)} />
      )}
      {lojaConcluirAgrupamento && (
        <ConcludeGroupingModal
          loja={lojaConcluirAgrupamento}
          aoFechar={() => setLojaConcluirAgrupamento(null)}
          aoConcluir={abrirEtiquetasAposConcluir}
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
