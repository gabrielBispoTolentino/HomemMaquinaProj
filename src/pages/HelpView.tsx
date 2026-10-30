import type { ReactNode } from "react";
import { featureOn, type FeatureId } from "../lib/features";
import { GADGETS } from "../lib/gadgets";
import "./CSS/Worldbuilding.css";

type HelpViewProps = {
  features: Set<FeatureId>;
  headStart?: ReactNode;
  onOpenSettings: () => void;
};

// Ctrl on Windows, Linux and Android keyboards; ⌘ on Apple ones.
const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

// The volume's guide: what each part of the archive is and how to use it. It only explains the features this
// volume has on, and points to Recursos for the rest, so it never describes buttons the user can't see.
export default function HelpView({ features, headStart, onOpenSettings }: HelpViewProps) {
  const on = (id: FeatureId) => featureOn(features, id);

  return (
    <article className="world-view">
      <header className="world-view__head">
        {headStart}
        <h2 className="world-view__title">
          <span className="world-view__kind">Volume</span>
          Ajuda
        </h2>
      </header>

      <div className="world-view__body help">
        <p className="settings__intro">
          O Archivist é o seu arquivo pessoal: cada volume é um fichário, e cada verbete é uma ficha dentro dele. Serve
          tanto para pesquisa (artigos, fontes, conceitos) quanto para criação (livros, mundos, campanhas).
        </p>

        <section className="help__section">
          <h3 className="settings__group-title">O fichário</h3>
          <dl className="help__terms">
            <dt>Volume</dt>
            <dd>Um projeto inteiro: um livro, uma tese, um mundo, uma campanha. Fica na estante, a lista de volumes.</dd>
            <dt>Verbete</dt>
            <dd>Uma ficha com título e texto: um personagem, uma fonte, uma cena, um conceito.</dd>
            <dt>Subgrupo</dt>
            <dd>Uma divisória dentro do volume, como um capítulo ou uma seção. Pode ter outros subgrupos dentro.</dd>
            <dt>Categoria</dt>
            <dd>Uma etiqueta colorida, como Personagem ou Fonte. Cada verbete tem no máximo uma.</dd>
          </dl>
        </section>

        <section className="help__section">
          <h3 className="settings__group-title">Escrever</h3>
          <ul className="help__list">
            <li>
              Tudo é <strong>arquivado sozinho</strong> enquanto você escreve. O aviso “Arquivado”, abaixo do título,
              confirma que está salvo neste aparelho.
            </li>
            {on("mentions") && (
              <li>
                Escreva <code>[[</code> e o começo de um título para <strong>citar outro verbete</strong>. A citação vira
                um link, e o verbete citado mostra “Mencionado em”.
              </li>
            )}
            {on("status") && <li>Marque o andamento de cada verbete: Ideia, Rascunho, Revisão ou Final.</li>}
            {on("fields") && <li>Use “+ Campo” para guardar dados curtos, como Idade, Região, Autor ou Ano.</li>}
            {on("templates") && <li>“+ Verbete” oferece modelos com categoria, campos e texto já prontos.</li>}
            {on("secrets") && (
              <li>
                Escreva entre <code>[segredo]</code> e <code>[/segredo]</code> o que os jogadores não devem ver. Esses
                trechos ficam de fora da versão dos jogadores do manuscrito.
              </li>
            )}
            {on("versions") && <li>Em “Versões”, guarde uma cópia do texto, compare com o atual e volte a ela.</li>}
            {GADGETS.some(gadget => on(gadget.feature)) && (
              <li>
                Clique com o <strong>botão direito</strong> no verbete para inserir algo abaixo daquela linha (
                {GADGETS.filter(gadget => on(gadget.feature))
                  .map(gadget => gadget.label.toLowerCase())
                  .join(", ")}
                ). No celular, toque em “+ Inserir”, no alto do verbete. Com texto selecionado, ou segurando Shift, o
                botão direito abre o menu de sempre, para copiar e colar.
              </li>
            )}
            {on("tables") && (
              <li>
                Numa <strong>tabela</strong>, ande entre as células com as setas, Enter e Tab. Comece uma célula com <code>=</code> para fazer contas, como{" "}
                <code>=B2*C2</code> ou <code>=SOMA(B2:B5)</code>; também há MÉDIA, MÍN, MÁX, CONT e ARRED, com{" "}
                <code>;</code> entre os valores. Com o cursor na tabela, a barra abaixo dela acrescenta e exclui linhas e
                colunas. As tabelas não contam como palavras escritas.
              </li>
            )}
            {on("images") && (
              <li>
                Uma <strong>imagem</strong> fica guardada no verbete, reduzida para não pesar, com uma legenda opcional
                embaixo. Clique nela para ver o botão que a remove. Ela aparece no manuscrito e vai junto no .md baixado.
              </li>
            )}
          </ul>
        </section>

        <section className="help__section">
          <h3 className="settings__group-title">Organizar e encontrar</h3>
          <ul className="help__list">
            <li>
              <strong>Arraste</strong> verbetes e subgrupos na lista para mudar a ordem ou guardá-los em outro
              subgrupo. No celular, toque e segure antes de arrastar.
            </li>
            <li>O botão ⋯ de um subgrupo cria, renomeia, move e exclui. Excluir um subgrupo nunca apaga o que está nele.</li>
            <li>
              A <strong>busca</strong> procura no título, no texto, nos campos, na categoria e no subgrupo, sem ligar
              para acentos.
            </li>
          </ul>
        </section>

        <section className="help__section">
          <h3 className="settings__group-title">Errou? Dá para voltar</h3>
          <ul className="help__list">
            <li>
              Um verbete excluído vai para a <strong>Lixeira</strong>. Logo depois aparece “Desfazer”; mais tarde, abra a
              Lixeira e toque em Restaurar.
            </li>
            <li>Nada sai do aparelho sem você ligar a sincronização, na lista de volumes.</li>
          </ul>
        </section>

        <section className="help__section">
          <h3 className="settings__group-title">No celular</h3>
          <ul className="help__list">
            <li>Toque em » para abrir a lista do volume. Ao escolher um verbete, a lista se fecha sozinha.</li>
            <li>O botão voltar do Android fecha a lista, depois o que estiver aberto, e por fim o volume.</li>
          </ul>
        </section>

        <section className="help__section help__section--keys">
          <h3 className="settings__group-title">Atalhos de teclado</h3>
          <dl className="help__keys">
            <dt>
              <kbd>{MOD}</kbd> <kbd>K</kbd>
            </dt>
            <dd>Buscar no volume</dd>
            <dt>
              <kbd>Alt</kbd> <kbd>N</kbd>
            </dt>
            <dd>Novo verbete</dd>
            <dt>
              <kbd>{MOD}</kbd> <kbd>S</kbd>
            </dt>
            <dd>Arquivar agora (já é automático)</dd>
            <dt>
              <kbd>{MOD}</kbd> <kbd>\</kbd>
            </dt>
            <dd>Mostrar ou esconder a lista</dd>
            <dt>
              <kbd>{MOD}</kbd> <kbd>/</kbd>
            </dt>
            <dd>Abrir esta ajuda</dd>
            <dt>
              <kbd>Esc</kbd>
            </dt>
            <dd>Cancelar o que está sendo editado, fechar menus e limpar a busca</dd>
          </dl>
        </section>

        <section className="help__section">
          <h3 className="settings__group-title">Recursos deste volume</h3>
          <p className="settings__intro">
            Quadro de fichas, linha do tempo, mapa de relações, mesa do mestre e outros recursos ligam e desligam em
            Recursos. Desligar só esconde; nada é apagado.
          </p>
          <button type="button" className="writing-button" onClick={onOpenSettings}>
            Abrir Recursos
          </button>
        </section>
      </div>
    </article>
  );
}
