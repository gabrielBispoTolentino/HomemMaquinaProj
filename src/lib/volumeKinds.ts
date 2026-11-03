import type { FeatureId } from "./features";
import type { Reference, SourceType } from "./references";

// The models a new volume can start from. Each one switches on the features that kind of work needs, and fills
// the volume with a starting structure: categories, subgroups and a few notes to write over.

// A note the author can start from (the "templates" feature), with its category, fields and text ready.
export type NoteTemplate = {
  id: string;
  label: string;
  category?: string;
  fields?: string[];
  content?: string;
  // Notes from this template made with the general "+ Verbete" go in the top-level subgroup with this name.
  subgroup?: string;
  // A source: with citations on, the note starts with an empty reference of this type instead of the fields.
  reference?: SourceType;
};

type SeedNote = {
  kind: "note";
  title: string;
  // Filled into the template's reference, for an example source.
  reference?: Partial<Omit<Reference, "type">>;
  content?: string;
  synopsis?: string;
  timeline?: string;
  // Takes category, fields and content from this template of the same kind (content above wins).
  template?: string;
  category?: string;
};

type SeedGroup = { kind: "subgroup"; name: string; children?: SeedItem[] };

export type SeedItem = SeedNote | SeedGroup;

export type VolumeKind = {
  id: "livro" | "mundo" | "academico" | "rpg" | "branco";
  label: string;
  description: string;
  icon: string;
  accent: string;
  features: FeatureId[];
  categories: string[];
  templates: NoteTemplate[];
  structure: SeedItem[];
};

const note = (title: string, extra: Omit<SeedNote, "kind" | "title"> = {}): SeedNote => ({ kind: "note", title, ...extra });
const group = (name: string, children: SeedItem[] = []): SeedGroup => ({ kind: "subgroup", name, children });

export const VOLUME_KINDS: VolumeKind[] = [
  {
    id: "livro",
    label: "Livro",
    description: "Romance ou conto: capítulos e cenas em ordem, personagens, manuscrito e metas de escrita.",
    icon: "📖",
    accent: "#f5a7a1",
    features: ["status", "goals", "manuscript", "corkboard", "versions", "footnotes", "fields", "templates", "mentions", "images"],
    categories: ["Personagem", "Lugar", "Cena"],
    templates: [
      {
        id: "cena",
        label: "Cena",
        category: "Cena",
        content: "Ponto de vista:\n\nObjetivo:\n\nConflito:\n\nDesfecho:\n",
      },
      {
        id: "personagem",
        label: "Personagem",
        category: "Personagem",
        fields: ["Nome completo", "Idade", "Aparência", "Motivação", "Arco"],
        subgroup: "Personagens",
      },
      { id: "lugar", label: "Lugar", category: "Lugar", fields: ["Onde fica", "Atmosfera"], subgroup: "Lugares" },
    ],
    structure: [
      group("Manuscrito", [
        group("Capítulo 1", [
          note("Cena 1", {
            template: "cena",
            synopsis: "Onde a história começa.",
            content: "Comece a escrever aqui. Use [[Protagonista]] para mencionar um verbete.\n",
          }),
        ]),
      ]),
      group("Personagens", [note("Protagonista", { template: "personagem" })]),
      group("Lugares"),
      group("Pesquisa"),
    ],
  },
  {
    id: "mundo",
    label: "Worldbuilding",
    description: "Um mundo para explorar: personagens, lugares, facções, história e as relações entre eles.",
    icon: "🗺",
    accent: "#a8d5c2",
    features: ["corkboard", "footnotes", "fields", "templates", "mentions", "timeline", "graph", "names", "versions", "tables", "images"],
    categories: ["Personagem", "Lugar", "Facção", "Evento"],
    templates: [
      {
        id: "personagem",
        label: "Personagem",
        category: "Personagem",
        fields: ["Nome completo", "Povo", "Idade", "Afiliação", "Aparência"],
        subgroup: "Personagens",
      },
      {
        id: "lugar",
        label: "Lugar",
        category: "Lugar",
        fields: ["Região", "População", "Governo", "Clima"],
        subgroup: "Lugares",
      },
      {
        id: "faccao",
        label: "Facção",
        category: "Facção",
        fields: ["Líder", "Objetivo", "Aliados", "Inimigos"],
        subgroup: "Facções",
      },
      {
        id: "evento",
        label: "Evento",
        category: "Evento",
        fields: ["Participantes", "Consequências"],
        subgroup: "História",
      },
    ],
    structure: [
      note("Visão geral", {
        content:
          "Descreva o mundo em poucas linhas: o tom, o que o torna único, os conflitos principais.\n\nCite verbetes com [[Nome]], como [[A Fundação]].\n",
      }),
      group("Personagens"),
      group("Lugares"),
      group("Facções"),
      group("História", [note("A Fundação", { template: "evento", timeline: "Ano 0" })]),
    ],
  },
  {
    id: "academico",
    label: "Acadêmico",
    description: "Artigo, tese ou revisão: seções do texto, fontes, conceitos e controle de versões.",
    icon: "🎓",
    accent: "#a9c7e8",
    features: ["status", "goals", "manuscript", "versions", "footnotes", "fields", "templates", "mentions", "citations", "tables", "images"],
    categories: ["Fonte", "Conceito", "Método", "Resultado"],
    templates: [
      {
        id: "fonte",
        label: "Fonte",
        category: "Fonte",
        fields: ["Autor(es)", "Ano", "Título", "Publicação", "DOI ou URL"],
        reference: "livro",
        content: "Resumo:\n\nCitações relevantes:\n\nComo usar no texto:\n",
        subgroup: "Fontes",
      },
      {
        id: "conceito",
        label: "Conceito",
        category: "Conceito",
        fields: ["Definição", "Autores de referência"],
        subgroup: "Conceitos",
      },
      { id: "secao", label: "Seção do texto", content: "Argumento principal:\n\n" },
      {
        id: "resultado",
        label: "Resultado",
        category: "Resultado",
        content:
          "O que os dados mostram:\n[tabela]\n| Grupo | n | Média |\n| Controle |  |  |\n| Experimental |  |  |\n| Total | =SOMA(B2:B3) | =MÉDIA(C2:C3) |\n[/tabela]\nInterpretação:\n",
      },
    ],
    structure: [
      group("Artigo", [
        note("Introdução", {
          template: "secao",
          content:
            "Argumento principal:\n\nCite uma fonte com [@Eco 2016, p. 45], que vira (ECO, 2016, p. 45) no manuscrito.[nota]As notas de rodapé são numeradas e vão para o fim do texto.[/nota]\n",
        }),
        note("Métodos", { template: "secao" }),
        note("Resultados", { template: "secao" }),
        note("Discussão", { template: "secao" }),
        note("Conclusão", { template: "secao" }),
      ]),
      group("Fontes", [
        note("Eco 2016", {
          template: "fonte",
          reference: {
            authors: "Eco, Umberto",
            title: "Como se faz uma tese",
            edition: "26",
            place: "São Paulo",
            publisher: "Perspectiva",
            year: "2016",
          },
        }),
      ]),
      group("Conceitos"),
    ],
  },
  {
    id: "rpg",
    label: "Campanha de RPG",
    description: "Sessões, PNJs, locais e missões, com segredos do mestre, dados e tabelas aleatórias.",
    icon: "🎲",
    accent: "#f3d38b",
    features: ["fields", "templates", "mentions", "timeline", "graph", "names", "secrets", "gmtools", "corkboard", "tables", "images"],
    categories: ["PNJ", "Local", "Facção", "Missão", "Tabela"],
    templates: [
      {
        id: "sessao",
        label: "Sessão",
        fields: ["Data", "Jogadores presentes"],
        content:
          "Resumo:\n\nAcontecimentos:\n\nGanchos em aberto:\n\n[segredo]\nNotas do mestre para a próxima sessão:\n[/segredo]\n",
        subgroup: "Sessões",
      },
      {
        id: "pnj",
        label: "PNJ",
        category: "PNJ",
        fields: ["Povo", "Ocupação", "Atitude com o grupo", "Onde encontrar"],
        content: "Aparência e jeito de falar:\n\n[segredo]\nO que ele esconde:\n[/segredo]\n",
        subgroup: "PNJs",
      },
      { id: "local", label: "Local", category: "Local", fields: ["Região", "Perigos", "Tesouros"], subgroup: "Locais" },
      {
        id: "missao",
        label: "Missão",
        category: "Missão",
        fields: ["Quem pediu", "Recompensa", "Situação"],
        subgroup: "Missões",
      },
      {
        id: "tabela",
        label: "Tabela aleatória",
        category: "Tabela",
        subgroup: "Tabelas",
      },
      {
        id: "inventario",
        label: "Inventário",
        content:
          "Quem carrega:\n[tabela]\n| Item | Qtd | Valor (po) | Total |\n| Corda (15 m) | 1 | 1 | =B2*C2 |\n| Ração de viagem | 5 | 0,5 | =B3*C3 |\n| Soma |  |  | =SOMA(D2:D3) |\n[/tabela]\n",
      },
    ],
    structure: [
      group("Sessões", [
        note("Sessão 1", {
          template: "sessao",
          timeline: "Dia 1",
          content:
            "Resumo:\nO grupo se conhece na taverna [[O Javali Dourado]].\n\nGanchos em aberto:\n\n[segredo]\nO taverneiro trabalha para a guilda dos ladrões.\n[/segredo]\n",
        }),
      ]),
      group("PNJs"),
      group("Locais", [note("O Javali Dourado", { template: "local" })]),
      group("Missões"),
      group("Tabelas", [
        note("Nomes de taverna", {
          template: "tabela",
          content: "O Javali Dourado\nA Caneca Furada\nO Dragão Sonolento\nA Última Vela\nO Corvo Bêbado\nA Ponte Torta\n",
        }),
      ]),
    ],
  },
  {
    id: "branco",
    label: "Em branco",
    description: "Só verbetes, categorias e subgrupos. Ligue os recursos que quiser depois.",
    icon: "✎",
    accent: "#c9b6e4",
    features: [],
    categories: [],
    templates: [],
    structure: [],
  },
];

export function volumeKind(id: string | null | undefined) {
  return VOLUME_KINDS.find(kind => kind.id === id) ?? null;
}

// The note templates a volume offers: its model's, or every model's (labelled by model) for volumes made before
// models existed or switched to "Em branco".
export function templatesFor(kindId: string | null | undefined): { group: string | null; templates: NoteTemplate[] }[] {
  const kind = volumeKind(kindId);
  if (kind && kind.templates.length) return [{ group: null, templates: kind.templates }];
  return VOLUME_KINDS.filter(item => item.templates.length).map(item => ({ group: item.label, templates: item.templates }));
}
