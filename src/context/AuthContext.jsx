import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, SUPABASE_CONFIGURADO } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// Controla login/sessão (Supabase Auth) e o perfil de acesso do usuário
// logado (tabela `profiles`, com o campo `grupo`: 'motorista' |
// 'administrativo' — ver supabase/schema.sql). Não há cadastro público: as contas
// são criadas manualmente por quem administra o sistema (Supabase
// dashboard, ou futuramente um painel próprio em Cadastros), então este
// contexto só cuida de entrar/sair e descobrir o grupo de quem já tem
// conta — nunca de criar uma.
export function AuthProvider({ children }) {
  // undefined = ainda não sabemos (checando a sessão salva); null = sem
  // sessão (deslogado); objeto = sessão ativa.
  const [sessao, setSessao] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState(null);

  useEffect(() => {
    // Sem Supabase configurado (ex: o preview do claude.ai, sem variáveis de
    // ambiente), nem tenta checar sessão — o App.jsx nesse caso já abre
    // direto em modo demonstração e nunca chega a olhar pra esses valores.
    if (!SUPABASE_CONFIGURADO) return undefined;
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setSessao(data.session);
    });
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
    });
    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  // Assim que há uma sessão, busca o perfil (nome + grupo) correspondente.
  // Sem perfil cadastrado, o login funciona mas o app nega acesso — cobre o
  // caso de alguém ter conta no Supabase Auth sem estar liberado no sistema.
  useEffect(() => {
    const idUsuario = sessao?.user?.id;
    if (!idUsuario) {
      setPerfil(null);
      setErroPerfil(null);
      return undefined;
    }
    let ativo = true;
    setCarregandoPerfil(true);
    setErroPerfil(null);
    supabase
      .from('profiles')
      .select('id, nome, grupo')
      .eq('id', idUsuario)
      .single()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error || !data) {
          setPerfil(null);
          setErroPerfil(
            'Seu login funcionou, mas não encontramos uma liberação de acesso pra você no sistema. Fale com o administrador.'
          );
        } else {
          setPerfil(data);
        }
        setCarregandoPerfil(false);
      });
    return () => {
      ativo = false;
    };
  }, [sessao?.user?.id]);

  const entrar = useCallback(async (email, senha) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return error;
  }, []);

  const sair = useCallback(() => supabase.auth.signOut(), []);

  const value = {
    sessao,
    usuario: sessao?.user ?? null,
    perfil,
    grupo: perfil?.grupo ?? null,
    // "carregando" cobre tanto a checagem inicial da sessão quanto, depois
    // de logado, a busca do perfil — enquanto isso, a tela de carregamento
    // fica visível em vez de piscar a tela de login ou o app sem permissão.
    carregando: sessao === undefined || (Boolean(sessao) && carregandoPerfil),
    erroPerfil,
    entrar,
    sair,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth deve ser usado dentro de um <AuthProvider>.');
  }
  return contexto;
}
