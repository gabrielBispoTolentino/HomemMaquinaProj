# Archivist — Literary Notes App

Design directions distilled from the product mind map (*Archivist — Mapa Mental da arquitetura conceitual do produto*). Use these as the guiding principles when designing or building any screen or feature.

## Interface metaphor (Metáfora de Interface)

The app should feel like the author's personal, private reference work, not a generic notes tool:

- **Personal compendium (Compêndio Pessoal)**: a curated collection of the author's lore.
- **Author's private wiki (Wiki Privada do Autor)**: interlinked articles, navigable like a wiki.
- **Creator's desk (Mesa do Criador)**: a workspace with a craft, writer's-desk feel.

UI copy, visuals and navigation should support this literary, archival metaphor.

## Objects and artifacts (Objetos e Artefatos)

- **Workspace (Livro/Volume)**: top-level container, the "worlds" in the code (`WorldList`, `WorldNotes`). Properties: **title**, **chapters**.
- **Article (Artigo/Nota)**: a single entry inside a workspace. Properties: **title**, **content**.
- **Structural categories (Categorias Estruturais)**: articles are classified as:
  - Factions & NPCs (Facções e NPCs)
  - Places & Gods (Lugares e Deuses)
  - Quests & Arcs (Missões e Arcos)
- **Custom fields (Campos Customizados)**: user-defined key-value pairs on articles.
- **Internal hyperlinks (Hiperlinks Internos)**: articles link to each other.
- **Visual relationship web (Teia de Relacionamentos Visual)**: a graph view of how articles connect.

## User activities (Atividades do Usuário)

- Article management (full CRUD)
- Quick categorization
- Mention & link other articles inline
- Instant global search
- Connection visualization

## Interaction and experience (Interação e Experiência)

- **WYSIWYG/Markdown editor**: rich editing that also works with Markdown.
- **Distraction-free focus (Foco Sem Distrações)**: writing comes first; keep chrome minimal while editing.
- **Collapsible side menu (Menu Lateral Recolhível)**: navigation lives in a sidebar that can be hidden.
- **Real-time cloud sync (Sincronização Nuvem Real-time)**: changes save and sync automatically (Supabase).

## Quality and security (Qualidade e Segurança)

- **Strict privacy**: user content is private by default.
- **Workspace isolation**: data from one workspace never leaks into another (enforce in queries and RLS).
- **Modular architecture**: keep features in self-contained, composable pieces.
- **Secure authentication**: auth goes through Supabase; never expose secrets client-side.
