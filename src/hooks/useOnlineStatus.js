import { useEffect, useState } from 'react';

// Acompanha o estado de conexão do navegador (navigator.onLine), atualizado
// automaticamente pelos eventos 'online'/'offline' do browser — usado pelo
// indicador de status no canto da tela, já que o app roda inteiramente no
// navegador (dados salvos localmente) e a única coisa que pode "cair" é a
// conexão de internet do dispositivo.
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    function aoFicarOnline() {
      setOnline(true);
    }
    function aoFicarOffline() {
      setOnline(false);
    }
    window.addEventListener('online', aoFicarOnline);
    window.addEventListener('offline', aoFicarOffline);
    return () => {
      window.removeEventListener('online', aoFicarOnline);
      window.removeEventListener('offline', aoFicarOffline);
    };
  }, []);

  return online;
}
