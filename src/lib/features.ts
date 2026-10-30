// Features a volume can switch on and off (in its "Recursos" screen). A volume made from a model starts with that
// model's set (see volumeKinds.ts); volumes made before features could be chosen have everything on.

export const FEATURE_GROUPS = [
  { id: "escrita", label: "Escrita" },
  { id: "mundo", label: "Mundo e referências" },
  { id: "rpg", label: "RPG" },
] as const;

export const FEATURES = [
  {
    id: "status",
    group: "escrita",
    label: "Status dos verbetes",
    description: "Ideia, Rascunho, Revisão ou Final em cada verbete, com filtro na lista.",
  },
  {
    id: "goals",
    group: "escrita",
    label: "Meta diária de palavras",
    description: "Palavras escritas hoje, uma meta por dia e os dias seguidos cumprindo a meta.",
  },
  {
    id: "manuscript",
    group: "escrita",
    label: "Manuscrito",
    description: "Ler um subgrupo ou o volume como texto corrido, para copiar, baixar ou imprimir.",
  },
  {
    id: "corkboard",
    group: "escrita",
    label: "Quadro de fichas",
    description: "Os verbetes como fichas com resumo, para arrastar e reorganizar o enredo.",
  },
  {
    id: "versions",
    group: "escrita",
    label: "Versões",
    description: "Guardar versões de um verbete, comparar com o texto atual e restaurar.",
  },
  {
    id: "tables",
    group: "escrita",
    label: "Tabelas",
    description: "Tabelas como as de uma planilha dentro do verbete, com fórmulas como =SOMA(B2:B5).",
  },
  {
    id: "fields",
    group: "mundo",
    label: "Campos personalizados",
    description: "Pares de nome e valor em cada verbete, como Idade, Região ou Autor.",
  },
  {
    id: "templates",
    group: "mundo",
    label: "Modelos de verbete",
    description: "Começar um verbete a partir de um modelo, com categoria, campos e texto prontos.",
  },
  {
    id: "images",
    group: "mundo",
    label: "Imagens",
    description: "Imagens no meio do texto do verbete, com legenda: figuras, mapas, retratos.",
  },
  {
    id: "mentions",
    group: "mundo",
    label: "Menções",
    description: "Escrever [[Nome]] para citar outro verbete e ver onde cada verbete é mencionado.",
  },
  {
    id: "timeline",
    group: "mundo",
    label: "Linha do tempo",
    description: "Um campo “Quando” nos verbetes e uma linha do tempo ordenada pelo ano.",
  },
  {
    id: "graph",
    group: "mundo",
    label: "Mapa de relações",
    description: "Um mapa de quais verbetes mencionam quais. Precisa das menções.",
  },
  {
    id: "names",
    group: "mundo",
    label: "Verificação de nomes",
    description: "Aponta nomes quase iguais aos dos verbetes, como “Auorra” e “Aurora”.",
  },
  {
    id: "secrets",
    group: "rpg",
    label: "Segredos do mestre",
    description: "Trechos entre [segredo] e [/segredo], escondidos na versão dos jogadores do manuscrito.",
  },
  {
    id: "gmtools",
    group: "rpg",
    label: "Mesa do mestre",
    description: "Rolador de dados, tabelas aleatórias e controle de iniciativa.",
  },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];

const ALL: FeatureId[] = FEATURES.map(feature => feature.id);

// The stored JSON array, or every feature when the volume predates the choice.
export function parseFeatures(stored: string | null | undefined): Set<FeatureId> {
  if (stored == null) return new Set(ALL);
  try {
    const ids = JSON.parse(stored);
    return new Set(Array.isArray(ids) ? ids.filter((id): id is FeatureId => ALL.includes(id)) : []);
  } catch {
    return new Set(ALL);
  }
}

export function serializeFeatures(features: Iterable<FeatureId>) {
  return JSON.stringify(ALL.filter(id => new Set(features).has(id)));
}

// The map is drawn from mentions, so it only works with them on.
export function featureOn(features: Set<FeatureId>, id: FeatureId) {
  if (id === "graph") return features.has("graph") && features.has("mentions");
  return features.has(id);
}
