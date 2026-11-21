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
- **Notas de rodapé** (in Escrita; on for Livro, Worldbuilding and Acadêmico): `[nota]…[/nota]` in the text, shown in small type in the note; the manuscript numbers them in reading order and gathers them under "Notas" at the end (`[^n]` in the .md download). They count as words written; the markers don't.
- **Tabelas** (in Escrita): spreadsheet-like tables inside a note, inserted from the note's right-click menu, stored in its text as `[tabela]` blocks of `| a | b |` rows (`src/lib/sheets.ts`, `SheetBlock`). A cell starting with `=` is a formula (references, + − * / ^ %, SOMA, MÉDIA, MÍN, MÁX, CONT, ARRED; `;` between arguments, decimal comma). Rows and columns inserted or removed move the formulas' references. The manuscript draws them as tables, the .md download as Markdown tables and copying as tab-separated rows; they don't count as words written.
- **Imagens** (in Mundo e referências): pictures inside a note, inserted from the right-click menu, scaled down (1600px, WebP/JPEG) and kept in the synced `note_images` table (`src/lib/images.ts`, `ImageBlock`); the text holds `[imagem:id|Legenda]`. An image stays as long as its note, so undo, versions and the Lixeira bring it back. The manuscript shows them and the .md download embeds them.
- **Mundo e referências**: custom fields, note templates, `[[mentions]]` with autocomplete and backlinks, timeline, relationship map (needs mentions), name check (near-misses like "Auorra"/"Aurora").
- **Pesquisa → Citações e referências** (on for Acadêmico): a note becomes a **source** with the "Fonte" button, which gives it a bibliographic reference (`notes.reference`, JSON; `src/lib/references.ts`, `ReferenceForm`); a note that kept its source in fields (Autor(es), Ano…) has them moved into the reference. `[@Título]`, `[@Título, p. 42]` or `[@A; @B]` cites it, with `[@` autocomplete (`src/lib/citations.ts`). Only ABNT: NBR 10520 in the text, "(ECO, 2016, p. 45)", and NBR 6023 in the reference list. The manuscript ends with "Referências" (the sources cited, alphabetical); the **Referências** view (`ReferencesView`) lists every source, where it's cited, uncited sources and citations with no source. Citing counts as mentioning for backlinks and the relationship map.
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

- **Editor**: plain text with `[[mentions]]` and `[segredo]` markers for now; a WYSIWYG/Markdown editor is still a goal. Until then, the **markers bar** above the text (`MARKERS` in `NoteEditor`) puts each marker (Mencionar, Citar, Nota de rodapé, Segredo, each gated by its feature) around the selection or at the caret, so nobody has to remember the brackets; it's always in place (dimmed while nothing is being written) so the text doesn't jump, and its buttons don't take the focus, so the phone keyboard stays open. Markers are text, so they live there; gadgets (blocks) stay in the right-click menu.
- **Distraction-free focus (Foco Sem Distrações)**: writing comes first; keep chrome minimal while editing.
- **Two panes**: the sidebar lists the volume (subgroups and notes); the middle shows the open note or a volume view (manuscript, corkboard, timeline, map, name check, GM table, Recursos, Lixeira, Ajuda), and, when nothing is open, shows one quiet line saying where to start. A volume reopens on the last note or view opened in it, even if it was closed afterwards (not Recursos); the first volume ever opened on a device starts on Ajuda, with a four-step tour of the archive's words over it (`VolumeTour`: volume, verbete, subgrupos e categorias, Recursos e Ajuda; skippable, closed by Esc or the back button). The first note opened shows a one-time tip about the note's menu and the markers bar. With nothing to reopen, the listing shows (the drawer opens on phones), never a blank page with the sidebar hidden.
- **Help (Ajuda, `HelpView`)**: explains the archive's terms, writing, organizing, undoing, phone use and keyboard shortcuts, and only describes features the volume has on. Keep it up to date when adding a feature or shortcut.
- **Confirmations and notices** go through `confirmAction()` and `notify()` (`src/pages/Dialogs.tsx`), never `window.confirm`/`alert`. Prefer undo (a notice with "Desfazer") over asking first; confirm only what can't be undone, say what happens to the contents, and mark destructive ones `danger`.
- **Motion** (`src/pages/CSS/Motion.css`): things move like paper in a binder, and only in answer to the user. Opening a volume grows its divider into the sidebar band (View Transition, `withTransition` in `App.tsx`); views are pulled out from the listing's side; filed, moved or restored items glow where they land (`landed` in `WorldNotes`); saves are stamped "Arquivado"; buttons give when pressed. Reuse the tokens and keyframes there instead of new durations, and add no motion that plays on its own. Reduced motion turns it all off.
- **Gadgets** (elements inserted into a note: tables, images) are offered only from the note's right-click menu, "Inserir" (`GadgetMenu`, labels only), and go under the line that was clicked; touch screens get a "+ Inserir" button for the same menu, since they have no right click. Every new gadget is an entry in `GADGETS` (`src/lib/gadgets.ts`) gated by its feature, with a block kind in `src/lib/blocks.ts` (the note's text is cut into text and blocks there) and a component in `NoteEditor`, never a button of its own. Text selected, Shift held or a long press keeps the system's menu (copy, paste).
- **Keyboard shortcuts** (desktop): Ctrl/⌘+K search, Alt+N new note, Ctrl/⌘+S save now, Ctrl/⌘+\ toggle the list, Ctrl/⌘+/ Ajuda, Esc cancels.
- **Phones**: touch targets at least 44px, nothing that needs hover, and check new screens at 390px wide, and with the keyboard open (about half the height). The open note scrolls as one page there and its text grows with what's written, keeping the line being written in view (`keepCaretInView` in `NoteEditor`).
- **Per-device preferences** (`src/lib/prefs.ts`, localStorage): reading text size (`--text-scale`) and one-time introductions (`seen`/`markSeen`: `volumeGuide`, `volumeTour`, `noteTip`).
- **Collapsible side menu (Menu Lateral Recolhível)**: on wide screens the sidebar can be hidden, and shows again each time a volume opens. On phones it's a drawer over the note, closed when the volume opens on a note or view (open when there is nothing to reopen); the Android back button closes the drawer, then the open view, then the volume, and from the volume list sends the app to the background; it never logs out (only "Sair" on the volume list does, after a confirmation).
- **Local-first storage**: notes save automatically to a local SQLite database. Cloud sync (below) is opt-in, runs in the background and must never slow down local editing.

## Data and storage (Dados e armazenamento)

- **The local database is the source of truth.** Volumes, notes and everything else live in a local SQLite database (`src/lib/db.ts`): native SQLite on Android/iOS (`@capacitor-community/sqlite`), a file opened with `node:sqlite` in Electron (`preload.cjs`), and sql.js saved to IndexedDB in the browser. The app reads and writes only there.
- **Login is Supabase Auth** (`src/lib/auth.ts`). When "Manter conectado" is ticked at login (off by default), the session is kept on the device and the user is remembered (`restoreUser`), so the app reopens logged in; otherwise the login lasts until the app closes, and the leftover Supabase session is dropped at the next start. A kept login reopens on the volume that was open (`archivist.lastWorld.<userId>` in `App.tsx`; going back to the volume list or logging out forgets it); a session that can't be refreshed offline still counts. `public.user` keeps the numeric user id that local volumes are filed under, linked by `auth_id`; accounts from before Supabase Auth move over on their first login. Every Supabase table has RLS so each user only reaches their own rows (`supabase/auth_sync.sql`).
- **Sync is opt-in, per user and device** (`src/lib/sync.ts`). After the first login on a device the user picks "só neste aparelho" or "neste aparelho e na nuvem" (`SyncChoice`); the volume list shows the state and can switch it. Triggers note every change to a synced table in `sync_changes`; a sync pulls other devices' rows from `public.sync_rows`, then pushes local ones, and the later change to a row wins. A new table that holds user content must be added to `SYNCED_TABLES` in `db.ts` (and to the `tbl` check in `auth_sync.sql`), or it won't be backed up. Turning sync off never deletes the cloud copy.
- **Schema changes**: new tables go in `SCHEMA`; new columns on existing tables must also be listed in `ADDED_COLUMNS` (with a `fill` for existing rows when needed), because `CREATE TABLE IF NOT EXISTS` doesn't touch existing databases. Users' databases must always upgrade in place.
- **Releases and updates** (`src/lib/updates.ts`): at start the app asks GitHub for the latest release of the public repo (nothing about the user is sent) and offers a newer one in a notice. The installed Windows app downloads `Archivist-Setup-X.Y.Z.exe`, installs it silently and reopens (`install-update` in `main.cjs`, which only accepts this repo's release downloads); Android opens `Archivist-X.Y.Z.apk` in the browser. To release: raise `version` in `package.json` (Android's versionName and versionCode come from it, in `android/app/build.gradle`), commit, push, then `bun run release`, which tags `vX.Y.Z` and pushes the tag (`scripts/release.cjs`); GitHub Actions (`.github/workflows/release.yml`) builds both and publishes the release, with the `.env` and the Android keystore kept as repository secrets (listed at the top of the workflow). Always sign the APK with that same keystore, or Android refuses the update.
- **One-time import**: a user's old Supabase volumes are copied into the local database once per device (`src/lib/supabaseImport.ts`).

## User study goals (Metas para o estudo com usuários)

The app is going to testers for a human–computer interaction study, evaluated with **SUS** (System Usability Scale) and **SAM** (Self-Assessment Manikin). Still to do, roughly in order:

- **Password recovery**: "Esqueci minha senha" on the login screen (Supabase `resetPasswordForEmail`), so a tester who forgets the password between sessions isn't locked out.
- **Email confirmation**: either turn it off in the Supabase project for the study, or say clearly on the sign-up screen that the email has to be confirmed before the first login.
- **Version in the app**: show the running version (from `package.json`) on the volume list or in Ajuda, so each answer can be tied to the build that was tested.
- **Install friction**: a short illustrated install guide (Android's "unknown sources" prompt; Windows SmartScreen), and ideally a trusted code-signing certificate for the Windows installer.
- **Release pipeline**: the Android signing secrets in GitHub Actions are empty, so tagged releases fail there; fix them, or keep building locally and publishing with `gh release create`.
- **In-app survey link**: an "Avaliar o app" button (or a prompt after some use) that opens the SUS + SAM form with the version and an anonymous participant code filled in.
- **Consent and metrics**: any usage measurement for the study must be anonymous and explained (LGPD and research ethics), in keeping with Strict privacy below; it should be opt-in, except the in-app questionnaires, which are on by default with an immediate way out (below).
- **Phone check**: go through the new screens (tour, tip, markers bar, empty states) at 390px wide and with the keyboard open, on a real Android device.

**In-app questionnaires (done, `src/lib/study.ts`, `StudyDialogs.tsx`)**: **on by default** (the author's decision for the study, an exception to the opt-in rule under Consent and metrics): every user is enrolled at login on each device with a code like `P-7K3Q`, and the first volume list or volume they see shows a card (`IntroDialog`) saying so, explaining what is kept, with "Não participar" and an optional participant code; no ESM is offered before that card is answered. Leaving the study is remembered (`archivist.study.optOut.<userId>`), so it doesn't re-enrol; "Participar" on the volume list joins again through the consent card. **ESM**: four questions (what were you doing; SEQ-style ease 1–7; concluded Sim/Parcial/Não; what got in the way, plus optional text up to 280 characters), offered at natural pauses (leaving a note or a volume, `studyCheckpoint`), at least 20 minutes apart and at most 6 a day; "Agora não" is recorded as skipped; "◔ Como foi?" in the volume's views row opens it at any time. **SAM**: valence, arousal and dominance on 9-point rows (5 original SVG figures, `Manikin`, with a touchable dot between each), offered right after consent ("antes") and from the study panel ("antes"/"depois"). Answers go to the local `study_responses` table, which is **not synced**; they hold only the answers, time, version, platform, volume model and screen, never note text or the account, and leave the device only when the tester sends them: "Enviar respostas por email" (in the panel, and offered after the "depois" SAM) opens the tester's own email app with a message to `STUDY_EMAIL` (`study.ts`) carrying the CSV, which the tester checks and sends; past about 1800 characters the CSV goes through the clipboard and the message asks for it to be pasted. The Electron app hands `mailto:` links to the system (`main.cjs`). CSV download/copy stays as a fallback. Leaving the study stops the questions; deleting the answers is separate.

For the study itself: a task script of 5–7 tasks covering both audiences (e.g. cite a source in an Acadêmico volume; link two characters with `[[ ]]` in a Worldbuilding volume; file a note into a subgroup; delete and restore a note; find a note by search), SAM before and after the tasks, SUS once at the end with a validated Portuguese translation, and one open question about what frustrated the tester most.

## Quality and security (Qualidade e Segurança)

- **Strict privacy**: user content is private by default and stays on the device unless the user turns sync on; then it goes only to their own RLS-protected rows.
- **Workspace isolation**: data from one volume never leaks into another; scope every query by volume (and volumes by user).
- **Modular architecture**: keep features in self-contained, composable pieces (data in `src/lib`, screens in `src/pages`, one feature switch each).
- **Secure authentication**: auth goes through Supabase; never expose secrets client-side.
