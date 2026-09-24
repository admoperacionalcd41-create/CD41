import React from 'react';
import {
  LayoutDashboard,
  Upload,
  PackageSearch,
  Tags,
  Truck,
  MapPin,
  BarChart3,
  Warehouse,
  Contact,
  X,
  LogOut,
} from 'lucide-react';
import ConnectionStatus from './ConnectionStatus.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const ROTULO_GRUPO = {
  motorista: 'Motorista',
  operacao: 'Operação',
  gestao: 'Gestão',
};

const ICONES = {
  dashboard: LayoutDashboard,
  importar: Upload,
  boxes: PackageSearch,
  agrupamento: Tags,
  carregamento: Truck,
  motoristas: MapPin,
  relatorios: BarChart3,
  cadastros: Contact,
};

function ListaAbas({ abas, abaAtiva, aoSelecionar }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {abas.map((aba) => {
        const Icone = ICONES[aba.chave];
        const ativa = abaAtiva === aba.chave;
        return (
          <button
            key={aba.chave}
            onClick={() => aoSelecionar(aba.chave)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              ativa
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
            }`}
          >
            <Icone size={18} />
            {aba.rotulo}
          </button>
        );
      })}
    </nav>
  );
}

function LogoGestaoDocas() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border-2 border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400">
        <Warehouse size={18} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight text-slate-800 dark:text-slate-100">Gestão de Docas</p>
        <p className="truncate text-[10px] font-semibold uppercase leading-tight tracking-widest text-slate-400 dark:text-brand-400/80">
          Separação &amp; Carregamento
        </p>
      </div>
    </div>
  );
}

// Menu lateral em gaveta — fica fechado por padrão em qualquer tamanho de
// tela, e só abre quando o usuário clica no botão de menu do cabeçalho
// (ver Header.jsx). Abre por cima do conteúdo (com um fundo escurecido
// atrás), em vez de empurrar/reservar espaço fixo na tela.
export default function Sidebar({ abas, abaAtiva, setAbaAtiva, aberto, aoFechar }) {
  const { perfil, usuario, sair } = useAuth();

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-slate-900/50" onClick={aoFechar} aria-hidden="true" />
      <aside className="relative flex w-64 max-w-[80vw] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 dark:border-slate-700">
          <LogoGestaoDocas />
          <button
            onClick={aoFechar}
            aria-label="Fechar menu"
            className="flex-shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        <ListaAbas
          abas={abas}
          abaAtiva={abaAtiva}
          aoSelecionar={(chave) => {
            setAbaAtiva(chave);
            aoFechar();
          }}
        />
        <div className="border-t border-slate-200 p-3 dark:border-slate-700">
          {/* Identidade de quem está logado + botão de sair — só existe
              quando há autenticação (Supabase configurado); sem isso
              `usuario`/`perfil` nunca chegam aqui porque o app inteiro fica
              preso nas telas de login/carregamento antes de renderizar a
              Sidebar. */}
          {usuario && (
            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-md bg-slate-100 px-2.5 py-2 dark:bg-slate-900/60">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {perfil?.nome || usuario.email}
                </p>
                <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                  {perfil?.grupo ? ROTULO_GRUPO[perfil.grupo] || perfil.grupo : usuario.email}
                </p>
              </div>
              <button
                onClick={sair}
                aria-label="Sair"
                title="Sair"
                className="flex-shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
          <ConnectionStatus />
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">Dados salvos localmente no navegador.</p>
        </div>
      </aside>
    </div>
  );
}
