import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

// Campo de menu suspenso com busca, usado nos formulários pra escolher um
// valor cadastrado na aba Cadastros (placas, motoristas, colaboradores —
// ver RegistrationsPage.jsx). Pedido do usuário: "em todos os campos que
// for escolher algo da aba de cadastro preciso que abra um menu suspenso".
//
// Diferente do <input list> + <datalist> usado antes, aqui só é possível
// escolher um valor que já está cadastrado — não dá mais pra digitar um
// valor novo na hora do carregamento/agrupamento. Se precisar de um
// motorista, placa ou colaborador novo, precisa cadastrar antes na aba
// Cadastros.
//
// `opcoes`: array de strings OU de objetos { valor, rotulo, extra? } — a
// forma com objeto é usada quando cada opção tem um detalhe extra pra
// mostrar ao lado (ex.: placas com "possui plataforma").
// `permiteVazio`: acrescenta uma opção "— Nenhum —" no topo da lista, pra
// campos opcionais (ex.: colaboradores, que podem ficar em branco).
// `temErro`: realça a borda em âmbar quando o campo é obrigatório e está
// vazio — a validação em si (bloquear o envio) continua sendo feita pelo
// formulário que usa este componente, já que um <button> não participa da
// validação nativa de obrigatoriedade do HTML.
// `mensagemVazia`: texto mostrado quando a lista de opções está vazia —
// usado, por exemplo, quando o chamador já filtrou a lista (ex.: só placas
// disponíveis) e quer explicar o motivo em vez do texto genérico padrão.
export default function SeletorCadastro({
  opcoes,
  valor,
  onSelecionar,
  placeholder = 'Selecione...',
  permiteVazio = false,
  temErro = false,
  disabled = false,
  className = '',
  mensagemVazia = 'Nada encontrado. Cadastre em Cadastros.',
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState(0);
  const containerRef = useRef(null);
  const buscaRef = useRef(null);

  const normalizadas = (opcoes || []).map((o) =>
    typeof o === 'string' ? { valor: o, rotulo: o, extra: null } : o
  );
  const comVazio = permiteVazio
    ? [{ valor: '', rotulo: '— Nenhum —', extra: null }, ...normalizadas]
    : normalizadas;
  const buscaLimpa = busca.trim().toLowerCase();
  const filtradas = buscaLimpa
    ? comVazio.filter((o) => o.rotulo.toLowerCase().includes(buscaLimpa))
    : comVazio;

  const selecionada = normalizadas.find((o) => o.valor === valor);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento) {
      if (containerRef.current && !containerRef.current.contains(evento.target)) {
        setAberto(false);
        setBusca('');
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    setDestaque(0);
    const id = setTimeout(() => buscaRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [aberto]);

  function selecionar(opcao) {
    onSelecionar(opcao.valor);
    setAberto(false);
    setBusca('');
  }

  function aoTeclarNaBusca(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setDestaque((d) => Math.min(d + 1, filtradas.length - 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      if (filtradas[destaque]) selecionar(filtradas[destaque]);
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      setAberto(false);
      setBusca('');
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAberto((a) => !a)}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:bg-slate-900 dark:disabled:bg-slate-800 ${
          temErro
            ? 'border-amber-400 dark:border-amber-500'
            : 'border-slate-300 focus:border-totvs-500 dark:border-slate-600 dark:focus:border-whatsapp-500'
        } ${className}`}
      >
        <span
          className={`truncate ${
            selecionada ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {selecionada ? selecionada.rotulo : placeholder}
        </span>
        <ChevronDown size={15} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
      </button>

      {aberto && (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-1.5 dark:border-slate-700">
            <Search size={13} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
            <input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={aoTeclarNaBusca}
              placeholder="Buscar..."
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtradas.length === 0 && (
              <li className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                {normalizadas.length === 0 ? mensagemVazia : 'Nada encontrado para essa busca.'}
              </li>
            )}
            {filtradas.map((o, i) => (
              <li key={o.valor || '__vazio__'}>
                <button
                  type="button"
                  onClick={() => selecionar(o)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                    i === destaque ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'
                  } ${
                    o.valor === valor
                      ? 'font-semibold text-totvs-700 dark:text-whatsapp-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="truncate">{o.rotulo}</span>
                  {o.extra && (
                    <span className="ml-2 flex-shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                      {o.extra}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
