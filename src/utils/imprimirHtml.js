// Prepara um documento HTML para impressão SEM abrir uma aba nova nem um
// iframe separado.
//
// Por quê: a primeira versão desta função usava um iframe oculto +
// iframe.contentWindow.print(). Isso evita o bloqueio de pop-up, mas ainda
// assim a caixa de impressão não aparecia dentro da pré-visualização do
// Artifact no claude.ai. O motivo é outro bloqueio, mais forte: o app roda
// dentro de um <iframe> com "sandbox" aplicado pelo claude.ai (para isolar
// o conteúdo com segurança), e um sandbox sem a permissão "allow-modals"
// bloqueia silenciosamente QUALQUER chamada de window.print() feita por
// script — sem lançar erro, sem evento, sem aviso. Isso vale tanto para a
// janela principal quanto para qualquer iframe filho criado dentro dela,
// porque iframes filhos herdam as restrições do sandbox do pai. Por isso a
// troca para iframe oculto (na correção anterior) não resolveu.
//
// A solução: em vez de pedir para o navegador abrir a caixa de impressão
// via script, preparamos o conteúdo DENTRO da própria página (escondido na
// tela, mas visível só durante a impressão via CSS @media print) e deixamos
// a impressão em si ser disparada pelo próprio usuário — pelo atalho do
// teclado (Ctrl+P / Cmd+P) ou pelo menu do navegador. Esse tipo de ação,
// feita diretamente pelo usuário na interface do navegador, não passa pela
// mesma restrição de "modais via script" do sandbox, então funciona mesmo
// dentro do preview do Artifact. Ainda tentamos chamar window.print()
// automaticamente (útil quando o app roda fora do preview, por exemplo no
// pacote .zip publicado em outro servidor, onde não há sandbox nenhum), mas
// a impressão não depende mais só disso.
const ID_AREA_IMPRESSAO = 'doca-manager-area-impressao';
const ID_ESTILO_IMPRESSAO = 'doca-manager-estilo-impressao';

function garantirEstiloGlobalDeImpressao() {
  if (document.getElementById(ID_ESTILO_IMPRESSAO)) return;
  const estilo = document.createElement('style');
  estilo.id = ID_ESTILO_IMPRESSAO;
  estilo.textContent = `
    #${ID_AREA_IMPRESSAO} { display: none; }
    @media print {
      body > *:not(#${ID_AREA_IMPRESSAO}) { display: none !important; }
      #${ID_AREA_IMPRESSAO} {
        display: block !important;
        position: static !important;
        margin: 0;
      }
    }
  `;
  document.head.appendChild(estilo);
}

export function imprimirHtml(html) {
  try {
    garantirEstiloGlobalDeImpressao();

    // O `html` recebido é um documento autônomo completo (com <html>,
    // <head>, <style>, <body>...), montado pelas funções montarHtml* em
    // imprimirProtocolo.js / LabelGenerator.jsx. Extraímos o <style> e o
    // conteúdo do <body> para injetar dentro da página atual.
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const estiloDocumento = doc.querySelector('style')?.textContent || '';
    const corpoDocumento = doc.body ? doc.body.innerHTML : html;

    let area = document.getElementById(ID_AREA_IMPRESSAO);
    if (!area) {
      area = document.createElement('div');
      area.id = ID_AREA_IMPRESSAO;
      document.body.appendChild(area);
    }
    area.innerHTML = `<style>${estiloDocumento}</style>${corpoDocumento}`;

    // Tentativa automática — funciona fora de contextos com sandbox restrito
    // (por exemplo, o pacote .zip rodando no servidor do próprio usuário).
    // Dentro do preview do Artifact, essa chamada é ignorada silenciosamente
    // pelo navegador, e é por isso que sempre orientamos o uso de Ctrl+P /
    // Cmd+P na interface (ver LoadingList.jsx e LabelGenerator.jsx).
    setTimeout(() => {
      try {
        window.print();
      } catch (erro) {
        // Ignorado de propósito: alguns contextos com sandbox bloqueiam essa
        // chamada sem lançar exceção nenhuma; outros lançam. De qualquer
        // forma, o conteúdo já está pronto para impressão manual.
      }
    }, 150);

    return true;
  } catch (erro) {
    console.warn('Não foi possível preparar a impressão:', erro);
    return false;
  }
}
