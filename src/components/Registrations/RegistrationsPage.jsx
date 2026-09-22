import React from 'react';
import { Users, Contact } from 'lucide-react';
import RegistrationList from './RegistrationList.jsx';
import PlacasRegistrationList from './PlacasRegistrationList.jsx';
import ContatosNotificacaoList from './ContatosNotificacaoList.jsx';
import LocalizacaoLojasRegistrationList from './LocalizacaoLojasRegistrationList.jsx';

export default function RegistrationsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        Cadastre aqui os colaboradores, motoristas e placas de veículo usados no dia a dia. Eles
        aparecem como sugestão automática (basta começar a digitar) nos formulários de{' '}
        <strong>Agrupamento</strong> (colaboradores) e <strong>Carregamento</strong> (motorista e
        placa) — sem impedir a digitação livre de um nome ou placa ainda não cadastrado. Os
        contatos de <strong>Notificação (WhatsApp)</strong> são quem recebe o aviso ao concluir um
        agrupamento. A <strong>Localização das Lojas</strong> destaca automaticamente (por GPS) o
        botão de Registrar Chegada na aba Motoristas quando o motorista estiver perto da loja.
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <RegistrationList
          titulo="Colaboradores"
          icone={Users}
          entidade="colaboradoresCadastrados"
          placeholder="Nome do colaborador"
        />
        <RegistrationList
          titulo="Motoristas"
          icone={Contact}
          entidade="motoristasCadastrados"
          placeholder="Nome do motorista"
        />
        <PlacasRegistrationList />
        <ContatosNotificacaoList />
        <LocalizacaoLojasRegistrationList />
      </div>
    </div>
  );
}
