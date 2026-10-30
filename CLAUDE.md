# Archivist — Literary Notes App

Design directions distilled from the product mind map (*Archivist — Mapa Mental da arquitetura conceitual do produto*), plus how the app is built today. Use these as the guiding principles when designing or building any screen or feature.

## Audience: academic and creative (Público: acadêmico e criativo)

Archivist serves two kinds of work equally, and features should support both:

- **Academic**: scientific articles, research notes, theses, literature reviews.
- **Creative**: book writing, worldbuilding, RPG campaigns.

When designing a feature:

- Prefer features that serve both audiences, such as interlinked articles, categories, custom fields, search and the relationship graph.
- When a feature is specific to one audience, plan for the other side's counterpart too. Examples: citations, references and footnotes for academic work; character sheets, timelines and campaign/session notes for creative work.
- Don't hard-code one audience's assumptions. Categories stay user-defined; each volume model (below) seeds its own set, e.g. Personagem/Lugar/Facção for worldbuilding, Fonte/Conceito/Método/Resultado for academic work.
- Keep UI copy neutral enough for both. The archive vocabulary (volume, verbete, arquivado) fits both a research archive and a writer's compendium; avoid wording that only makes sense for fiction or only for research.

## Interface metaphor (Metáfora de Interface)

The app should feel like the author's personal, private reference work, not a generic notes tool:

- **Personal compendium (Compêndio Pessoal)**: a curated collection of the author's material, whether lore or research.
- **Author's private wiki (Wiki Privada do Autor)**: interlinked articles, navigable like a wiki.
- **Creator's desk (Mesa do Criador)**: a workspace with a craft, writer's-desk feel.

UI copy, visuals and navigation should support this literary, archival metaphor: volumes are tabbed binder dividers, notes are index cards, dates are stamps, categories are index tabs (shared styles in `src/pages/CSS/Binder.css`).

## Objects and artifacts (Objetos e Artefatos)

- **Volume (Livro/Volume)**: the top-level container, "worlds" in the code (`src/lib/worlds.ts`, `WorldList`, `WorldNotes`). Has a name, color, icon, the **model** it was created from (`kind`) and the **features** it has switched on.
- **Verbete (Artigo/Nota)**: a single entry inside a volume (`src/lib/notes.ts`). Title and content, plus optional status, synopsis, custom fields, a "Quando" for the timeline, a category and a subgroup.
- **Subgroups (Subgrupos)**: nestable, collapsible folders inside a volume (`src/lib/subgroups.ts`). Separate from categories: a note sits in at most one subgroup and has at most one category. Names only need to be unique among siblings. Deleting a subgroup moves its contents up a level, never deletes them.
- **Manual order**: inside each subgroup (and at the top of the volume), subgroups and notes share one `position` order, changed by drag and drop (`src/lib/order.ts`, `src/pages/useDragDrop.tsx`).
- **Categories (Categorias)**: user-defined labels per volume, shown as colored index tabs (`src/lib/categories.ts`).
- **Custom fields (Campos Customizados)**: user-defined key-value pairs on notes.
- **Internal hyperlinks (Hiperlinks Internos)**: `[[Título]]` in a note's text mentions another note (`src/lib/mentions.ts`).
- **Visual relationship web (Teia de Relacionamentos Visual)**: the map of which notes mention which (`RelationshipMap`).

## Volume models (Modelos de volume)

A new volume starts from a model, defined in `src/lib/volumeKinds.ts`: **Livro**, **Worldbuilding**, **Acadêmico**, **Campanha de RPG** or **Em branco**. A model sets the volume's color and icon, which features start on, its starting categories, subgroups and example notes, and the **note templates** it offers ("+ Verbete" → PNJ, Fonte, Cena…: category, fields and starting text).

To change what a kind of volume comes with, edit its entry there. Seeded notes don't count towards the daily word goal.

## Features (Recursos)

Each volume switches features on and off in its "Recursos" screen (`VolumeSettings`). Off hides the feature's buttons, fields and views but never deletes data. Volumes made before features existed have everything on. The list lives in `src/lib/features.ts`:

- **Escrita**: status (Ideia → Rascunho → Revisão → Final), daily word goal and streak, manuscript (read a subgroup as continuous text, copy, download .md, print), corkboard (index cards with synopsis, drag to re-plot), versions (snapshots, paragraph diff, restore).
- **Tabelas** (in Escrita): spreadsheet-like tables inside a note, stored in its text as `[tabela]` blocks of `| a | b |` rows (`src/lib/sheets.ts`, `SheetBlock`). A cell starting with `=` is a formula (references, + − * / ^ %, SOMA, MÉDIA, MÍN, MÁX, CONT, ARRED; `;` between arguments, decimal comma). Rows and columns inserted or removed move the formulas' references. The manuscript draws them as tables, the .md download as Markdown tables and copying as tab-separated rows; they don't count as words written.
- **Mundo e referências**: custom fields, note templates, `[[mentions]]` with autocomplete and backlinks, timeline, relationship map (needs mentions), name check (near-misses like "Auorra"/"Aurora").
- **RPG**: GM secrets (`[segredo]…[/segredo]`, left out of the players' version of the manuscript), GM table (dice, random tables from notes, initiative).

When adding a feature:

- Add it to `FEATURES` with a group, label and description, and to the defaults of the models that need it.
- Gate every piece of its UI with `featureOn(features, "id")`; never show it unconditionally.
- Think about both audiences (see above) before tying it to one model.

## User activities (Atividades do Usuário)

- Note management (full CRUD), with autosave; deleting moves a note to the volume's **Lixeira** (`deleted_at` in `notes.ts`), with "Desfazer" right away and Restaurar later
- Volume management: name, description, color and icon edited in Recursos; deleting a volume asks for its name to be typed
- Quick categorization and filing into subgroups (menu or drag and drop)
- Mention & link other notes inline
- Instant search across title, text, synopsis, fields, category and subgroup path; filter by category and status
- Connection visualization (relationship map, timeline, corkboard)

## Interaction and experience (Interação e Experiência)

- **Editor**: plain text with `[[mentions]]` and `[segredo]` markers for now; a WYSIWYG/Markdown editor is still a goal.
- **Distraction-free focus (Foco Sem Distrações)**: writing comes first; keep chrome minimal while editing.
- **Two panes**: the sidebar lists the volume (subgroups and notes); the middle shows the open note or a volume view (manuscript, corkboard, timeline, map, name check, GM table, Recursos, Lixeira, Ajuda), and is blank when nothing is open. A volume reopens on what was open when it was left (not Recursos); the first volume ever opened on a device starts on Ajuda.
- **Help (Ajuda, `HelpView`)**: explains the archive's terms, writing, organizing, undoing, phone use and keyboard shortcuts, and only describes features the volume has on. Keep it up to date when adding a feature or shortcut.
- **Confirmations and notices** go through `confirmAction()` and `notify()` (`src/pages/Dialogs.tsx`), never `window.confirm`/`alert`. Prefer undo (a notice with "Desfazer") over asking first; confirm only what can't be undone, say what happens to the contents, and mark destructive ones `danger`.
- **Motion** (`src/pages/CSS/Motion.css`): things move like paper in a binder, and only in answer to the user. Opening a volume grows its divider into the sidebar band (View Transition, `withTransition` in `App.tsx`); views are pulled out from the listing's side; filed, moved or restored items glow where they land (`landed` in `WorldNotes`); saves are stamped "Arquivado"; buttons give when pressed. Reuse the tokens and keyframes there instead of new durations, and add no motion that plays on its own. Reduced motion turns it all off.
- **Keyboard shortcuts** (desktop): Ctrl/⌘+K search, Alt+N new note, Ctrl/⌘+S save now, Ctrl/⌘+\ toggle the list, Ctrl/⌘+/ Ajuda, Esc cancels.
- **Phones**: touch targets at least 44px, nothing that needs hover, and check new screens at 390px wide.
- **Per-device preferences** (`src/lib/prefs.ts`, localStorage): reading text size (`--text-scale`) and one-time introductions.
- **Collapsible side menu (Menu Lateral Recolhível)**: on wide screens the sidebar can be hidden (remembered). On phones it's a drawer over the note, closed when the volume opens; the Android back button closes the drawer, then the open view, then the volume.
- **Local-first storage**: notes save automatically to a local SQLite database. Cloud sync (below) is opt-in, runs in the background and must never slow down local editing.

## Data and storage (Dados e armazenamento)

- **The local database is the source of truth.** Volumes, notes and everything else live in a local SQLite database (`src/lib/db.ts`): native SQLite on Android/iOS (`@capacitor-community/sqlite`), a file opened with `node:sqlite` in Electron (`preload.cjs`), and sql.js saved to IndexedDB in the browser. The app reads and writes only there.
- **Login is Supabase Auth** (`src/lib/auth.ts`). `public.user` keeps the numeric user id that local volumes are filed under, linked by `auth_id`; accounts from before Supabase Auth move over on their first login. Every Supabase table has RLS so each user only reaches their own rows (`supabase/auth_sync.sql`).
- **Sync is opt-in, per user and device** (`src/lib/sync.ts`). After the first login on a device the user picks "só neste aparelho" or "neste aparelho e na nuvem" (`SyncChoice`); the volume list shows the state and can switch it. Triggers note every change to a synced table in `sync_changes`; a sync pulls other devices' rows from `public.sync_rows`, then pushes local ones, and the later change to a row wins. A new table that holds user content must be added to `SYNCED_TABLES` in `db.ts` (and to the `tbl` check in `auth_sync.sql`), or it won't be backed up. Turning sync off never deletes the cloud copy.
- **Schema changes**: new tables go in `SCHEMA`; new columns on existing tables must also be listed in `ADDED_COLUMNS` (with a `fill` for existing rows when needed), because `CREATE TABLE IF NOT EXISTS` doesn't touch existing databases. Users' databases must always upgrade in place.
- **One-time import**: a user's old Supabase volumes are copied into the local database once per device (`src/lib/supabaseImport.ts`).

## Quality and security (Qualidade e Segurança)

- **Strict privacy**: user content is private by default and stays on the device unless the user turns sync on; then it goes only to their own RLS-protected rows.
- **Workspace isolation**: data from one volume never leaks into another; scope every query by volume (and volumes by user).
- **Modular architecture**: keep features in self-contained, composable pieces (data in `src/lib`, screens in `src/pages`, one feature switch each).
- **Secure authentication**: auth goes through Supabase; never expose secrets client-side.
