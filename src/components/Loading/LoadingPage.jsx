import React, { useState } from 'react';
import LoadingList from './LoadingList.jsx';
import LoadingProtocolForm from './LoadingProtocolForm.jsx';
import NotifyWhatsappModal from '../Shared/NotifyWhatsappModal.jsx';

export default function LoadingPage({ irPara }) {
  // Array de lojas: 1 item para o fluxo tradicional (uma loja por
  // protocolo, com suporte a envio parcial/saldo), 2+ itens quando o
  // operador seleciona várias lojas para sair juntas no mesmo veículo.
  const [lojasProtocolo, setLojasProtocolo] = useState(null);
  // Mensagem pronta pra notificar a equipe assim que um protocolo é
  // registrado com sucesso (ver LoadingProtocolForm -> aoRegistrar).
  const [mensagemNotificar, setMensagemNotificar] = useState(null);

  return (
    <div>
      <LoadingList aoAbrirProtocolo={setLojasProtocolo} />
      {lojasProtocolo && (
        <LoadingProtocolForm
          lojas={lojasProtocolo}
          aoFechar={() => setLojasProtocolo(null)}
          aoRegistrar={setMensagemNotificar}
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
    </div>
  );
}
