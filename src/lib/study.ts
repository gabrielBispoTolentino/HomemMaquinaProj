import { Capacitor } from "@capacitor/core";
import pkg from "../../package.json";
import { newId, now, queryAll, queryOne, run } from "./db";

// The usability study's in-app questionnaires, for testers who agreed to take part (opt-in, per user and device):
// - ESM (Experience Sampling): four quick questions about what the tester was just doing, asked now and then at a
//   natural pause (leaving a note, leaving a volume; see studyCheckpoint), or whenever the tester opens it.
// - SAM (Self-Assessment Manikin): valence, arousal and dominance on 9-point picture scales, before and after the
//   study's tasks.
// Answers stay in the local database and leave the device only when the tester sends them by email (to STUDY_EMAIL)
// or exports them.
// Nothing written in the notes is ever recorded: only the answers, the time, the app version, the platform, the
// kind of volume and the screen the tester was on. The export carries the participant code, never the account.

export const APP_VERSION: string = pkg.version;

// Where the answers are sent: the person running the study. The tester's own email app sends them (see
// emailStudyResponses), so no server or key is involved and the tester sees what goes out.
export const STUDY_EMAIL = "tolentinocrb@gmail.com";

export type EsmEase = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type EsmDone = "sim" | "parcial" | "nao";
export type EsmObstacle = "nada" | "nao_achei" | "nao_entendi" | "erro_lentidao" | "outro";

export type EsmAnswers =
  | { skipped: true }
  | { skipped?: false; activity: string; ease: EsmEase; done: EsmDone; obstacle: EsmObstacle; comment: string };

export type SamAnswers = { valence: number; arousal: number; dominance: number };

// Where the tester was when asked: the volume's model and the open view (note, manuscript, volumes list…).
export type StudyContext = { volumeKind?: string | null; view?: string | null };

export type EsmTrigger = "auto" | "manual";
export type SamMoment = "antes" | "depois";

export type StudyDialog =
  | { kind: "consent"; intro?: boolean }
  | { kind: "panel" }
  | { kind: "esm"; trigger: EsmTrigger; context: StudyContext }
  | { kind: "sam"; moment: SamMoment; context: StudyContext };

type Enrolment = {
  participant: string;
  consentedAt: string;
  // The last time an ESM was offered automatically (or the consent, before the first), and how many were offered
  // on which local day.
  lastPromptAt: string;
  promptDay: string;
  promptsToday: number;
  // False while the card saying the tester was enrolled by default hasn't been shown yet (see showStudyIntro).
  introSeen?: boolean;
};

// An automatic ESM waits at least this long after the last one (or the consent), and stops after a few per day,
// so it samples the work without getting in its way.
const PROMPT_GAP_MS = 20 * 60 * 1000;
const PROMPTS_PER_DAY = 6;

export const ESM_COMMENT_MAX = 280;
export const ESM_ACTIVITY_MAX = 140;

let userId: number | null = null;
let dialog: StudyDialog | null = null;
const listeners = new Set<() => void>();

function changed() {
  listeners.forEach(listener => listener());
}

export function subscribeStudy(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const KEY = (id: number) => `archivist.study.${id}`;

function readEnrolment(): Enrolment | null {
  if (userId === null) return null;
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as Enrolment) : null;
  } catch {
    return null;
  }
}

function writeEnrolment(value: Enrolment | null) {
  if (userId === null) return;
  try {
    if (value) localStorage.setItem(KEY(userId), JSON.stringify(value));
    else localStorage.removeItem(KEY(userId));
  } catch {
    // Without storage the study can't remember the tester; nothing else breaks.
  }
  changed();
}

// Called on login and logout (App.tsx): the study is per user on this device.
// Everyone takes part by default: a user with no enrolment on this device is enrolled at login, unless they left
// the study before (OPT_OUT_KEY). The first volume list or volume they see tells them so (showStudyIntro), with a
// way out.
export function setStudyUser(id: number | null) {
  userId = id;
  dialog = null;
  if (id !== null && !readEnrolment() && !optedOut()) {
    const at = now();
    writeEnrolment({ participant: randomCode(), consentedAt: at, lastPromptAt: at, promptDay: localDay(), promptsToday: 0, introSeen: false });
  }
  changed();
}

const OPT_OUT_KEY = (id: number) => `archivist.study.optOut.${id}`;

function optedOut() {
  if (userId === null) return true;
  try {
    return localStorage.getItem(OPT_OUT_KEY(userId)) === "1";
  } catch {
    return false;
  }
}

function setOptedOut(value: boolean) {
  if (userId === null) return;
  try {
    if (value) localStorage.setItem(OPT_OUT_KEY(userId), "1");
    else localStorage.removeItem(OPT_OUT_KEY(userId));
  } catch {
    // Without storage the choice can't be kept; the next login enrols again and shows the card again.
  }
}

// Shows, once, the card saying the tester was enrolled by default. Called by the screens where it fits.
export function showStudyIntro() {
  const enrolment = readEnrolment();
  if (!enrolment || enrolment.introSeen !== false || dialog) return;
  openStudyDialog({ kind: "consent", intro: true });
}

// The tester stays in the study after the card: their code (if they typed one) replaces the generated one.
export function confirmStudyIntro(code: string) {
  const enrolment = readEnrolment();
  if (!enrolment) return;
  const clean = code.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 24);
  writeEnrolment({ ...enrolment, participant: clean || enrolment.participant, introSeen: true });
}

export function participant(): string | null {
  return readEnrolment()?.participant ?? null;
}

export function getStudyDialog() {
  return dialog;
}

export function openStudyDialog(next: StudyDialog) {
  if (userId === null) return;
  dialog = next;
  changed();
}

export function closeStudyDialog() {
  dialog = null;
  changed();
}

export function isStudyDialogOpen() {
  return dialog !== null;
}

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// A short code such as "P-7K3Q", without letters that read like digits.
function randomCode() {
  const letters = "ACDEFGHJKMNPQRTUVWXY34679";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `P-${Array.from(bytes, byte => letters[byte % letters.length]).join("")}`;
}

export function joinStudy(code: string) {
  const at = now();
  const clean = code.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 24);
  setOptedOut(false);
  writeEnrolment({ participant: clean || randomCode(), consentedAt: at, lastPromptAt: at, promptDay: localDay(), promptsToday: 0, introSeen: true });
}

// Stops the questions. The answers stay until deleted (deleteStudyResponses), so they can still be exported.
export function leaveStudy() {
  setOptedOut(true);
  writeEnrolment(null);
  dialog = null;
  changed();
}

// A natural pause in the work: maybe offer an ESM. Never while another dialog is open.
export function studyCheckpoint(context: StudyContext, otherDialogOpen = false) {
  const enrolment = readEnrolment();
  if (!enrolment || enrolment.introSeen === false || dialog || otherDialogOpen) return;
  const today = localDay();
  const promptsToday = enrolment.promptDay === today ? enrolment.promptsToday : 0;
  if (promptsToday >= PROMPTS_PER_DAY) return;
  if (Date.now() - new Date(enrolment.lastPromptAt).getTime() < PROMPT_GAP_MS) return;
  writeEnrolment({ ...enrolment, lastPromptAt: now(), promptDay: today, promptsToday: promptsToday + 1 });
  openStudyDialog({ kind: "esm", trigger: "auto", context });
}

function platform() {
  if ((window as { __UPDATER__?: unknown }).__UPDATER__) return "windows";
  if (navigator.userAgent.includes("Electron")) return "desktop";
  return Capacitor.getPlatform();
}

type ResponseRow = {
  id: string;
  participant: string;
  method: "esm" | "sam";
  moment: string;
  answers: string;
  context: string;
  created_at: string;
};

async function save(method: "esm" | "sam", moment: string, answers: EsmAnswers | SamAnswers, context: StudyContext) {
  const enrolment = readEnrolment();
  if (!enrolment || userId === null) return;
  await run(
    `INSERT INTO study_responses (id, user_id, participant, method, moment, answers, context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      userId,
      enrolment.participant,
      method,
      moment,
      JSON.stringify(answers),
      JSON.stringify({ version: APP_VERSION, platform: platform(), volumeKind: context.volumeKind ?? null, view: context.view ?? null }),
      now(),
    ],
  );
  changed();
}

export const saveEsm = (trigger: EsmTrigger, answers: EsmAnswers, context: StudyContext) => save("esm", trigger, answers, context);
export const saveSam = (moment: SamMoment, answers: SamAnswers, context: StudyContext) => save("sam", moment, answers, context);

export async function countStudyResponses() {
  if (userId === null) return 0;
  const row = await queryOne<{ n: number }>("SELECT count(*) AS n FROM study_responses WHERE user_id = ?", [userId]);
  return Number(row?.n ?? 0);
}

export async function deleteStudyResponses() {
  if (userId === null) return;
  await run("DELETE FROM study_responses WHERE user_id = ?", [userId]);
  changed();
}

const CSV_COLUMNS = [
  "participante",
  "metodo",
  "momento",
  "data_hora",
  "versao",
  "plataforma",
  "modelo_volume",
  "tela",
  "esm_pulou",
  "esm_atividade",
  "esm_facilidade_1a7",
  "esm_concluiu",
  "esm_atrapalhou",
  "esm_comentario",
  "sam_valencia_1a9",
  "sam_alerta_1a9",
  "sam_dominancia_1a9",
] as const;

function csvCell(value: unknown) {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// All of this user's answers on this device, one row each, oldest first. Scales: ESM ease 1 = muito difícil,
// 7 = muito fácil; SAM 1 = desprazer / calma / pouco controle, 9 = prazer / agitação / muito controle.
export async function exportStudyCsv() {
  if (userId === null) return "";
  const rows = await queryAll<ResponseRow>(
    "SELECT id, participant, method, moment, answers, context, created_at FROM study_responses WHERE user_id = ? ORDER BY created_at",
    [userId],
  );
  const lines = rows.map(row => {
    const answers = JSON.parse(row.answers) as Record<string, unknown>;
    const context = JSON.parse(row.context) as Record<string, unknown>;
    const esm = row.method === "esm";
    const values: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      participante: row.participant,
      metodo: row.method.toUpperCase(),
      momento: row.moment,
      data_hora: row.created_at,
      versao: context.version,
      plataforma: context.platform,
      modelo_volume: context.volumeKind,
      tela: context.view,
      esm_pulou: esm ? (answers.skipped ? "sim" : "nao") : "",
      esm_atividade: esm ? answers.activity : "",
      esm_facilidade_1a7: esm ? answers.ease : "",
      esm_concluiu: esm ? answers.done : "",
      esm_atrapalhou: esm ? answers.obstacle : "",
      esm_comentario: esm ? answers.comment : "",
      sam_valencia_1a9: esm ? "" : answers.valence,
      sam_alerta_1a9: esm ? "" : answers.arousal,
      sam_dominancia_1a9: esm ? "" : answers.dominance,
    };
    return CSV_COLUMNS.map(column => csvCell(values[column])).join(",");
  });
  return [CSV_COLUMNS.join(","), ...lines].join("\r\n") + "\r\n";
}

// Some mail apps (Windows' especially) cut a mailto: link short past about 2000 characters, so a longer set of
// answers goes in through the clipboard instead, with the message asking the tester to paste it.
const MAILTO_BODY_MAX = 1800;

// Opens the tester's email app with a message to STUDY_EMAIL carrying the answers as CSV; the tester checks it and
// sends it. The answers are also copied, in case the message comes out empty. Says whether they had to be pasted.
export async function emailStudyResponses(): Promise<{ pasted: boolean }> {
  const code = participant() ?? "sem código";
  const csv = await exportStudyCsv();
  let copied = false;
  try {
    await navigator.clipboard.writeText(csv);
    copied = true;
  } catch {
    // Only a fallback; the message may still carry the answers itself.
  }
  const intro = `Respostas do estudo de usabilidade do Archivist.\nParticipante: ${code}\nVersão: ${APP_VERSION}\n\n`;
  const inline = encodeURIComponent(intro + csv).length <= MAILTO_BODY_MAX;
  const body = inline
    ? intro + csv
    : intro + (copied ? "As respostas foram copiadas: cole-as aqui (segure e toque em Colar, ou Ctrl+V) antes de enviar.\n" : "");
  const subject = `Archivist: respostas do estudo (${code}, v${APP_VERSION})`;
  window.location.href = `mailto:${STUDY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { pasted: !inline };
}
