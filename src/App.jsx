import React, { useEffect, useState } from 'react';
import Sidebar from './components/Layout/Sidebar.jsx';
import Header from './components/Layout/Header.jsx';
import ConnectionStatus from './components/Layout/ConnectionStatus.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import DataImport from './components/Import/DataImport.jsx';
import BoxGrid from './components/Boxes/BoxGrid.jsx';
import GroupingPage from './components/Grouping/GroupingPage.jsx';
import LoadingPage from './components/Loading/LoadingPage.jsx';
import DriversPage from './components/Drivers/DriversPage.jsx';
import ReportsPage from './components/Reports/ReportsPage.jsx';
import RegistrationsPage from './components/Registrations/RegistrationsPage.jsx';
import LoginPage from './components/Auth/LoginPage.jsx';
import TelaCarregando from './components/Auth/TelaCarregando.jsx';
import AcessoNegado from './components/Auth/AcessoNegado.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { SUPABASE_CONFIGURADO } from './lib/supabaseClient';

// `grupos` lista quem pode ver cada aba — motorista só tem acesso à tela
// que ele realmente usa no dia a dia (registrar chegada/saída);
// administrativo tem acesso total, incluindo operação, relatórios,
// cadastros e importação de dados.
//
// A aba Dashboard fica oculta do menu por escolha do usuário (o
// componente/rota continuam existindo em renderConteudo, caso precise
// voltar — basta reinserir a entrada aqui). "Boxes & Vagas" é a primeira
// da lista de propósito: é ela que abre por padrão ao entrar no app (ver
// useEffect logo abaixo, que sempre cai na primeira aba permitida).
export const ABAS = [
  { chave: 'boxes', rotulo: 'Boxes & Vagas', grupos: ['administrativo'] },
  { chave: 'agrupamento', rotulo: 'Agrupamento & Etiquetas', grupos: ['administrativo'] },
  { chave: 'carregamento', rotulo: 'Carregamento', grupos: ['administrativo'] },
  { chave: 'motoristas', rotulo: 'Motoristas', grupos: ['motorista', 'administrativo'] },
  { chave: 'relatorios', rotulo: 'Relatórios', grupos: ['administrativo'] },
  { chave: 'cadastros', rotulo: 'Cadastros', grupos: ['administrativo'] },
  { chave: 'importar', rotulo: 'Importar Dados', grupos: ['administrativo'] },
];

function AppLogado({ grupo }) {
  const abasPermitidas = ABAS.filter((a) => a.grupos.includes(grupo));
  const [abaAtiva, setAbaAtiva] = useState(null);
  // O menu lateral começa sempre fechado — só abre quando o usuário clica
  // no botão de menu do cabeçalho (ver Header.jsx) — e fecha sozinho ao
  // escolher uma aba ou clicar fora dele.
  const [menuAberto, setMenuAberto] = useState(false);

  // A aba inicial depende do grupo (só sabido depois do login), e se o
  // grupo mudar (ou a aba atual deixar de ser permitida por algum motivo)
  // sempre cai de volta pra primeira aba que esse grupo pode ver.
  useEffect(() => {
    if (!abasPermitidas.some((a) => a.chave === abaAtiva)) {
      setAbaAtiva(abasPermitidas[0]?.chave ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo]);

  function renderConteudo() {
    switch (abaAtiva) {
      case 'dashboard':
        return <Dashboard irPara={setAbaAtiva} />;
      case 'importar':
        return <DataImport />;
      case 'boxes':
        // Clicar numa loja dentro de um box leva pra aba Agrupamento &
        // Etiquetas (onde ficam as ações daquela loja — etiquetas, mover,
        // concluir), sem abrir nenhuma tela por cima automaticamente.
        return <BoxGrid irPara={setAbaAtiva} aoAbrirAgrupamento={() => setAbaAtiva('agrupamento')} />;
      case 'agrupamento':
        return <GroupingPage irPara={setAbaAtiva} />;
      case 'carregamento':
        return <LoadingPage irPara={setAbaAtiva} />;
      case 'motoristas':
        return <DriversPage />;
      case 'relatorios':
        return <ReportsPage />;
      case 'cadastros':
        return <RegistrationsPage />;
      default:
        return null;
    }
  }

  if (!abaAtiva) return <TelaCarregando />;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
      <Sidebar
        abas={abasPermitidas}
        abaAtiva={abaAtiva}
        setAbaAtiva={setAbaAtiva}
        aberto={menuAberto}
        aoFechar={() => setMenuAberto(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          tituloAba={ABAS.find((a) => a.chave === abaAtiva)?.rotulo}
          abaAtiva={abaAtiva}
          onAbrirMenu={() => setMenuAberto(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Na aba Boxes & Vagas, o conteúdo preenche toda a altura
              disponível (h-full) e se organiza em flex-col internamente, pra
              a lista de veículos do card "Andamento das Entregas" ganhar
              rolagem própria dentro do espaço que sobra — em vez de a
              página inteira precisar rolar. Nas outras abas o wrapper
              continua sem altura fixa, do jeito que sempre foi. */}
          <div className={`mx-auto max-w-7xl ${abaAtiva === 'boxes' ? 'h-full' : ''}`}>{renderConteudo()}</div>
        </main>
      </div>

      {/* O menu lateral agora é sempre uma gaveta fechada por padrão (em
          qualquer tamanho de tela), então o indicador de conexão que antes
          morava no rodapé da sidebar fixa do desktop precisa de uma versão
          flutuante própria, sempre visível no canto inferior esquerdo. */}
      <div className="fixed bottom-3 left-3 z-30 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <ConnectionStatus />
      </div>
    </div>
  );
}

// Porta de entrada do app: sem Supabase configurado (ex: o preview do
// claude.ai, que não tem variáveis de ambiente), o app abre direto em modo
// demonstração, com acesso total e sem exigir login — exatamente como
// sempre funcionou antes de existir autenticação. Com Supabase configurado
// (o site publicado no Vercel), passa a exigir login de verdade: tela de
// carregamento (checando sessão ou buscando o perfil), tela de login,
// acesso negado (login válido mas sem grupo liberado) ou o app — nessa
// ordem.
export default function App() {
  const { carregando, usuario, grupo, erroPerfil } = useAuth();

  if (!SUPABASE_CONFIGURADO) return <AppLogado grupo="administrativo" />;
  if (carregando) return <TelaCarregando texto={usuario ? 'Carregando seu perfil...' : 'Verificando sessão...'} />;
  if (!usuario) return <LoginPage />;
  if (erroPerfil) return <AcessoNegado mensagem={erroPerfil} />;
  if (!grupo) return <TelaCarregando texto="Carregando seu perfil..." />;

  return <AppLogado grupo={grupo} />;
}
