import React, { useState } from 'react';
import { MapPin, Plus, Trash2, LocateFixed } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

// Cadastro de coordenadas das lojas — usado pra detectar automaticamente
// (via GPS do navegador) quando o motorista chegou perto da loja, na aba
// Motoristas. Cada item é só código + nome (opcional) + latitude/longitude;
// cadastrar de novo o mesmo código substitui a coordenada salva.
export default function LocalizacaoLojasRegistrationList() {
  const { state, actions } = useApp();
  const [codigo, setCodigo] = useState('');
  const [nomeLoja, setNomeLoja] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [erroLocal, setErroLocal] = useState('');
  const [buscandoLocalizacao, setBuscandoLocalizacao] = useState(false);

  const lista = state.localizacaoLojas || [];

  function aoAdicionar(e) {
    e.preventDefault();
    const codigoLimpo = codigo.trim().toUpperCase();
    const lat = Number(latitude.replace(',', '.'));
    const lon = Number(longitude.replace(',', '.'));
    if (!codigoLimpo) {
      setErroLocal('Informe o código da loja.');
      return;
    }
    if (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      setErroLocal('Informe latitude e longitude válidas.');
      return;
    }
    actions.cadastrarItem('localizacaoLojas', { codigo: codigoLimpo, nomeLoja, latitude: lat, longitude: lon });
    setCodigo('');
    setNomeLoja('');
    setLatitude('');
    setLongitude('');
    setErroLocal('');
  }

  // Preenche lat/long com a posição atual de quem está cadastrando — útil
  // quando o cadastro é feito no local (em frente à loja), em vez de
  // digitar a coordenada copiada do mapa.
  function usarLocalizacaoAtual() {
    if (!navigator.geolocation) {
      setErroLocal('Este navegador não suporta geolocalização.');
      return;
    }
    setBuscandoLocalizacao(true);
    setErroLocal('');
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setLatitude(String(posicao.coords.latitude.toFixed(6)));
        setLongitude(String(posicao.coords.longitude.toFixed(6)));
        setBuscandoLocalizacao(false);
      },
      () => {
        setErroLocal('Não foi possível obter sua localização — verifique a permissão de GPS do navegador.');
        setBuscandoLocalizacao(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <MapPin size={16} className="text-brand-600 dark:text-brand-400" />
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Localização das Lojas</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
          {lista.length}
        </span>
      </div>
      <p className="mb-3 text-[11px] text-slate-400 dark:text-slate-500">
        Cadastre a coordenada de cada loja pra destacar automaticamente (por GPS) o botão de Registrar
        Chegada na aba Motoristas quando o motorista estiver perto dela.
      </p>

      <form onSubmit={aoAdicionar} className="space-y-2">
        <input
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value);
            setErroLocal('');
          }}
          placeholder="Código da loja (ex.: 0407)"
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm uppercase text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
        <input
          value={nomeLoja}
          onChange={(e) => setNomeLoja(e.target.value)}
          placeholder="Nome da loja (opcional)"
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={latitude}
            onChange={(e) => {
              setLatitude(e.target.value);
              setErroLocal('');
            }}
            placeholder="Latitude"
            inputMode="decimal"
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
          <input
            value={longitude}
            onChange={(e) => {
              setLongitude(e.target.value);
              setErroLocal('');
            }}
            placeholder="Longitude"
            inputMode="decimal"
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>
        <button
          type="button"
          onClick={usarLocalizacaoAtual}
          disabled={buscandoLocalizacao}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          <LocateFixed size={13} />
          {buscandoLocalizacao ? 'Buscando localização...' : 'Usar minha localização atual'}
        </button>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={14} /> Adicionar
        </button>
      </form>
      {erroLocal && <p className="mt-2 text-xs font-medium text-red-500">{erroLocal}</p>}

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
        {lista.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Nenhuma loja com localização cadastrada ainda.</p>
        ) : (
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {lista.map((item) => (
              <li
                key={item.codigo}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {item.codigo}
                    {item.nomeLoja && <span className="font-normal text-slate-400 dark:text-slate-500"> — {item.nomeLoja}</span>}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </span>
                </span>
                <button
                  onClick={() => actions.removerItem('localizacaoLojas', item.codigo)}
                  title={`Remover localização da loja ${item.codigo}`}
                  className="flex-shrink-0 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
