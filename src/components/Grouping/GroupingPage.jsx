import React, { useState } from 'react';
import GroupingForm from './GroupingForm.jsx';
import GroupingBoard from './GroupingBoard.jsx';
import GroupingHistory from './GroupingHistory.jsx';
import LabelGenerator from './LabelGenerator.jsx';
import StartGroupingModal from './StartGroupingModal.jsx';
import ConcludeGroupingModal from './ConcludeGroupingModal.jsx';
import NotifyWhatsappModal from '../Shared/NotifyWhatsappModal.jsx';
import MoveBoxModal from '../Shared/MoveBoxModal.jsx';
import { montarMensagemAgrupamento } from '../../utils/notificacoes';

export default function GroupingPage({ irPara }) {
  const [lojaEtiquetas, setLojaEtiquetas] = useState(null);
  const [lojaIniciarAgrupamento, setLojaIniciarAgrupamento] = useState(null);
  const [lojaConcluirAgrupamento, setLojaConcluirAgrupamento] = useState(null);
  const [lojaMover, setLojaMover] = useState(null);
  const [mensagemNotificar, setMensagemNotificar] = useState(null);

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
          aoConcluir={(loja) => setMensagemNotificar(montarMensagemAgrupamento(loja))}
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
