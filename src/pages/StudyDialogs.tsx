import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  APP_VERSION,
  closeStudyDialog,
  confirmStudyIntro,
  countStudyResponses,
  deleteStudyResponses,
  sendPendingStudyResponses,
  ESM_ACTIVITY_MAX,
  ESM_COMMENT_MAX,
  exportStudyCsv,
  getStudyDialog,
  joinStudy,
  leaveStudy,
  openStudyDialog,
  participant,
  saveEsm,
  saveSam,
  subscribeStudy,
  type EsmDone,
  type EsmEase,
  type EsmObstacle,
  type EsmTrigger,
  type SamMoment,
  type StudyContext,
} from "../lib/study";
import "./CSS/Dialogs.css";
import "./CSS/Study.css";
import { confirmAction, notify } from "./Dialogs.tsx";

// The usability study's dialogs (see study.ts): consent, the study panel, the ESM questions and the SAM scales.
// Mounted once in App, like DialogHost; any screen opens one with openStudyDialog().

export function useStudy() {
  const snapshot = () => `${participant() ?? ""}|${getStudyDialog()?.kind ?? ""}`;
  return useSyncExternalStore(subscribeStudy, snapshot, snapshot);
}

export function StudyHost() {
  useStudy();
  const dialog = getStudyDialog();
  if (!dialog) return null;
  if (dialog.kind === "consent") return dialog.intro ? <IntroDialog /> : <ConsentDialog />;
  if (dialog.kind === "panel") return <StudyPanel />;
  if (dialog.kind === "esm") return <EsmDialog trigger={dialog.trigger} context={dialog.context} />;
  return <SamDialog moment={dialog.moment} context={dialog.context} />;
}

// For the Android back button: an automatic ESM closed this way counts as skipped, like "Agora não".
export function closeStudyDialogAsCancel() {
  const dialog = getStudyDialog();
  if (!dialog) return false;
  if (dialog.kind === "esm" && dialog.trigger === "auto") void saveEsm("auto", { skipped: true }, dialog.context);
  closeStudyDialog();
  return true;
}

// An index card over the screen, like a confirmation, that keeps Tab inside and closes on Esc.
function StudyCard({ title, labelId, onCancel, children, wide }: { title: ReactNode; labelId: string; onCancel: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const card = ref.current;
    (card?.querySelector<HTMLElement>("[data-autofocus]") ?? card?.querySelector<HTMLElement>("input, button"))?.focus();
    return () => previous?.focus?.();
  }, []);

  return (
    <div className="dialog-backdrop study-backdrop">
      <section
        ref={ref}
        className={`dialog study${wide ? " study--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "Tab") {
            // Tab goes round the card's own controls: from the last back to the first, and the other way.
            const stops = Array.from(ref.current?.querySelectorAll<HTMLElement>("input, textarea, button:not(:disabled)") ?? []);
            const first = stops[0];
            const last = stops[stops.length - 1];
            const active = document.activeElement;
            const firstGroup = first instanceof HTMLInputElement && first.type === "radio" ? first.name : null;
            const atFirst = active === first || (firstGroup !== null && active instanceof HTMLInputElement && active.name === firstGroup);
            if (!event.shiftKey && active === last) {
              event.preventDefault();
              first?.focus();
            } else if (event.shiftKey && atFirst) {
              event.preventDefault();
              last?.focus();
            }
          }
        }}
      >
        <h2 id={labelId} className="dialog__title">
          {title}
        </h2>
        {children}
      </section>
    </div>
  );
}

// What taking part means, shared by the consent card and the card shown to testers enrolled by default.
function StudyTerms() {
  return (
    <ul className="study__list">
      <li>
        <strong>De vez em quando</strong>, numa pausa (ao sair de um verbete, por exemplo), aparecem quatro perguntas
        rápidas sobre o que você estava fazendo. Dá para responder “Agora não”.
      </li>
      <li>
        <strong>Antes e depois das tarefas</strong> do estudo, você marca como se sente em três escalas de figuras.
      </li>
      <li>
        <strong>O que fica guardado:</strong> só as suas respostas, a hora, a versão do app, o aparelho, o modelo do
        volume e a tela em que você estava. Nunca o que você escreve, nem seu nome ou email.
      </li>
      <li>
        <strong>Para onde vão:</strong> as respostas são enviadas sozinhas, pela internet, para o banco de dados do
        estudo, só com o seu código de participante. Uma cópia fica neste aparelho. Seus volumes não vão junto, com ou
        sem sincronização.
      </li>
    </ul>
  );
}

// Shown once to a tester enrolled by default (see setStudyUser): they're already taking part, and can leave here.
function IntroDialog() {
  const [code, setCode] = useState("");
  const current = participant();

  const decline = async () => {
    closeStudyDialog();
    leaveStudy();
    notify("Você não está participando. Para entrar no estudo depois, use “Participar” na lista de volumes.");
  };

  return (
    <StudyCard title="Você está participando do estudo" labelId="study-intro-title" onCancel={() => undefined}>
      <div className="study__body">
        <p className="dialog__message">
          Esta versão do Archivist faz parte de um estudo que avalia se ele é fácil e agradável de usar. Você entrou
          automaticamente, com o código <strong className="study__code">{current}</strong>. Se não quiser participar,
          toque em “Não participar”; dá para sair a qualquer momento, na lista de volumes.
        </p>
        <StudyTerms />
        <label className="dialog__field">
          Código de participante <span className="study__hint">(se recebeu um; senão, fica o código acima)</span>
          <input
            className="dialog__input"
            value={code}
            onChange={event => setCode(event.target.value)}
            maxLength={24}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder={current ?? "Ex.: P-12"}
          />
        </label>
      </div>
      <div className="dialog__actions">
        <button type="button" className="dialog__button" onClick={decline}>
          Não participar
        </button>
        <button
          type="button"
          className="dialog__button dialog__button--confirm"
          data-autofocus
          onClick={() => {
            confirmStudyIntro(code);
            openStudyDialog({ kind: "sam", moment: "antes", context: { view: "volumes" } });
          }}
        >
          Continuar
        </button>
      </div>
    </StudyCard>
  );
}

function ConsentDialog() {
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);

  return (
    <StudyCard title="Participar do estudo?" labelId="study-consent-title" onCancel={closeStudyDialog}>
      <div className="study__body">
        <p className="dialog__message">
          Este estudo avalia se o Archivist é fácil e agradável de usar. Participar é voluntário e você pode sair quando
          quiser, na lista de volumes.
        </p>
        <StudyTerms />
        <label className="dialog__field">
          Código de participante <span className="study__hint">(se recebeu um; senão, um código é criado)</span>
          <input
            className="dialog__input"
            value={code}
            onChange={event => setCode(event.target.value)}
            maxLength={24}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="Ex.: P-12"
          />
        </label>
        <label className="study__check">
          <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
          Li e aceito participar
        </label>
      </div>
      <div className="dialog__actions">
        <button type="button" className="dialog__button" onClick={closeStudyDialog}>
          Agora não
        </button>
        <button
          type="button"
          className="dialog__button dialog__button--confirm"
          disabled={!agreed}
          onClick={() => {
            joinStudy(code);
            // The study starts with how the tester feels before any task.
            openStudyDialog({ kind: "sam", moment: "antes", context: { view: "volumes" } });
          }}
        >
          Participar
        </button>
      </div>
    </StudyCard>
  );
}

function StudyPanel() {
  const [counts, setCounts] = useState<{ total: number; pending: number } | null>(null);
  const count = counts?.total ?? 0;
  const code = participant();

  // Counted again whenever an answer is saved or sent while the panel is open.
  useEffect(() => {
    const load = () =>
      countStudyResponses()
        .then(setCounts)
        .catch(() => setCounts({ total: 0, pending: 0 }));
    load();
    void sendPendingStudyResponses();
    return subscribeStudy(load);
  }, []);

  const exportAnswers = async () => {
    const csv = await exportStudyCsv();
    const name = `archivist-estudo-${code ?? "respostas"}-v${APP_VERSION}.csv`;
    // The phone apps can't save a downloaded file from the WebView; copying works everywhere.
    if (Capacitor.isNativePlatform()) {
      await navigator.clipboard.writeText(csv);
      notify("Respostas copiadas. Cole numa mensagem ou num arquivo para entregar.");
      return;
    }
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyAnswers = async () => {
    await navigator.clipboard.writeText(await exportStudyCsv());
    notify("Respostas copiadas.");
  };

  const leave = async () => {
    closeStudyDialog();
    const confirmed = await confirmAction({
      title: "Sair do estudo?",
      message:
        "As perguntas param de aparecer e nada mais é enviado, nem as respostas que ainda aguardam envio. As já enviadas continuam no estudo; a cópia deste aparelho fica até você apagá-la.",
      confirmLabel: "Sair do estudo",
    });
    if (confirmed) leaveStudy();
    else openStudyDialog({ kind: "panel" });
  };

  const erase = async () => {
    closeStudyDialog();
    const confirmed = await confirmAction({
      title: "Apagar as respostas?",
      message: `As ${count} respostas guardadas neste aparelho somem de vez, inclusive as que ainda não foram enviadas. As já enviadas continuam no estudo: para apagá-las, peça a quem conduz o estudo, informando o código ${code ?? ""}.`,
      confirmLabel: "Apagar respostas",
      danger: true,
    });
    if (confirmed) {
      await deleteStudyResponses();
      notify("Respostas apagadas.");
    }
    openStudyDialog({ kind: "panel" });
  };

  return (
    <StudyCard title="Estudo de usabilidade" labelId="study-panel-title" onCancel={closeStudyDialog}>
      <p className="dialog__message">
        Participante <strong className="study__code">{code}</strong> · versão {APP_VERSION}
        <br />
        {counts === null
          ? "…"
          : count === 0
            ? "Nenhuma resposta ainda."
            : `${count === 1 ? "1 resposta" : `${count} respostas`}${
                counts.pending === 0 ? (count === 1 ? ", enviada." : ", todas enviadas.") : `, ${counts.pending} aguardando envio (sem internet?).`
              }`}
      </p>
      <div className="study__panel-actions">
        <button type="button" className="study__action" onClick={() => openStudyDialog({ kind: "sam", moment: "antes", context: { view: "volumes" } })}>
          Como me sinto: antes das tarefas
        </button>
        <button type="button" className="study__action" onClick={() => openStudyDialog({ kind: "sam", moment: "depois", context: { view: "volumes" } })}>
          Como me sinto: depois das tarefas
        </button>
        <button type="button" className="study__action" onClick={() => openStudyDialog({ kind: "esm", trigger: "manual", context: { view: "volumes" } })}>
          Contar como foi agora
        </button>
        <button type="button" className="study__action" onClick={exportAnswers} disabled={!count}>
          {Capacitor.isNativePlatform() ? "Copiar respostas (CSV)" : "Baixar respostas (CSV)"}
        </button>
        {!Capacitor.isNativePlatform() && (
          <button type="button" className="study__action" onClick={copyAnswers} disabled={!count}>
            Copiar respostas
          </button>
        )}
      </div>
      <div className="dialog__actions study__panel-footer">
        <button type="button" className="dialog__button study__quiet" onClick={erase} disabled={!count}>
          Apagar respostas
        </button>
        <button type="button" className="dialog__button study__quiet" onClick={leave}>
          Sair do estudo
        </button>
        <button type="button" className="dialog__button dialog__button--confirm" onClick={closeStudyDialog} data-autofocus>
          Fechar
        </button>
      </div>
    </StudyCard>
  );
}

// ESM -----------------------------------------------------------------------------------------------------------

const ACTIVITY_SUGGESTIONS = ["Escrevendo", "Organizando verbetes", "Procurando algo", "Ligando ou citando", "Revisando", "Explorando o app"];

const EASE_LABELS: Record<EsmEase, string> = {
  1: "muito difícil",
  2: "difícil",
  3: "um pouco difícil",
  4: "nem fácil nem difícil",
  5: "um pouco fácil",
  6: "fácil",
  7: "muito fácil",
};

const DONE_OPTIONS: { id: EsmDone; label: string }[] = [
  { id: "sim", label: "Sim" },
  { id: "parcial", label: "Parcial" },
  { id: "nao", label: "Não" },
];

const OBSTACLES: { id: EsmObstacle; label: string }[] = [
  { id: "nada", label: "Nada" },
  { id: "nao_achei", label: "Não achei" },
  { id: "nao_entendi", label: "Não entendi" },
  { id: "erro_lentidao", label: "Erro ou lentidão" },
  { id: "outro", label: "Outro" },
];

function Chips<T extends string | number>({
  name,
  options,
  value,
  onChange,
  labelledBy,
  scale,
}: {
  scale?: boolean;
  name: string;
  options: { id: T; label: string; title?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  labelledBy: string;
}) {
  return (
    <div className={`study__chips${scale ? " study__chips--scale" : ""}`} role="radiogroup" aria-labelledby={labelledBy}>
      {options.map(option => (
        <label key={option.id} className="study__chip" title={option.title}>
          <input type="radio" name={name} checked={value === option.id} onChange={() => onChange(option.id)} aria-label={option.title} />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function EsmDialog({ trigger, context }: { trigger: EsmTrigger; context: StudyContext }) {
  const [activity, setActivity] = useState("");
  const [ease, setEase] = useState<EsmEase | null>(null);
  const [done, setDone] = useState<EsmDone | null>(null);
  const [obstacle, setObstacle] = useState<EsmObstacle | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const complete = activity.trim() !== "" && ease !== null && done !== null && obstacle !== null;

  const skip = () => {
    if (trigger === "auto") void saveEsm("auto", { skipped: true }, context);
    closeStudyDialog();
  };

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    try {
      await saveEsm(trigger, { activity: activity.trim(), ease: ease!, done: done!, obstacle: obstacle!, comment: comment.trim() }, context);
      closeStudyDialog();
      notify("Obrigado! Resposta arquivada.");
    } catch (err) {
      console.warn("Não foi possível guardar a resposta.", err);
      notify("Não foi possível guardar a resposta.");
      setSaving(false);
    }
  };

  return (
    <StudyCard title="Como foi até aqui?" labelId="esm-title" onCancel={skip}>
      <div className="study__body">
        <div className="study__question">
          <label htmlFor="esm-activity" id="esm-q1" className="study__label">
            <span className="study__number">1</span> O que você estava fazendo?
          </label>
          <input
            id="esm-activity"
            className="dialog__input study__wide-input"
            value={activity}
            onChange={event => setActivity(event.target.value)}
            maxLength={ESM_ACTIVITY_MAX}
            placeholder="Em poucas palavras"
            data-autofocus={trigger === "manual" ? true : undefined}
          />
          <div className="study__suggestions" aria-label="Sugestões">
            {ACTIVITY_SUGGESTIONS.map(text => (
              <button key={text} type="button" className="study__suggestion" aria-pressed={activity === text} onClick={() => setActivity(text)}>
                {text}
              </button>
            ))}
          </div>
        </div>

        <div className="study__question">
          <p id="esm-q2" className="study__label">
            <span className="study__number">2</span> Foi fácil fazer o que queria?
          </p>
          <Chips
            name="esm-ease"
            scale
            labelledBy="esm-q2"
            value={ease}
            onChange={setEase}
            options={([1, 2, 3, 4, 5, 6, 7] as EsmEase[]).map(n => ({ id: n, label: String(n), title: `${n}: ${EASE_LABELS[n]}` }))}
          />
          <div className="study__ends" aria-hidden="true">
            <span>Muito difícil</span>
            <span>Muito fácil</span>
          </div>
        </div>

        <div className="study__question">
          <p id="esm-q3" className="study__label">
            <span className="study__number">3</span> Conseguiu concluir?
          </p>
          <Chips name="esm-done" labelledBy="esm-q3" value={done} onChange={setDone} options={DONE_OPTIONS} />
        </div>

        <div className="study__question">
          <p id="esm-q4" className="study__label">
            <span className="study__number">4</span> Algo atrapalhou?
          </p>
          <Chips name="esm-obstacle" labelledBy="esm-q4" value={obstacle} onChange={setObstacle} options={OBSTACLES} />
          <label className="dialog__field study__comment">
            <span>
              {obstacle === "outro" ? "O quê?" : "Quer contar mais?"} <span className="study__hint">(opcional)</span>
            </span>
            <textarea
              className="dialog__input"
              value={comment}
              onChange={event => setComment(event.target.value.slice(0, ESM_COMMENT_MAX))}
              maxLength={ESM_COMMENT_MAX}
              rows={2}
            />
            <span className="study__counter" aria-live="polite">
              {comment.length}/{ESM_COMMENT_MAX}
            </span>
          </label>
        </div>
      </div>
      <div className="dialog__actions">
        <button type="button" className="dialog__button" onClick={skip}>
          {trigger === "auto" ? "Agora não" : "Cancelar"}
        </button>
        <button type="button" className="dialog__button dialog__button--confirm" disabled={!complete || saving} onClick={submit}>
          Enviar
        </button>
      </div>
    </StudyCard>
  );
}

// SAM -----------------------------------------------------------------------------------------------------------

type SamDimension = "valence" | "arousal" | "dominance";

const SAM_SCALES: { id: SamDimension; question: string; low: string; high: string; levels: string[] }[] = [
  {
    id: "valence",
    question: "Quão agradável é o que você sente?",
    low: "Desprazer",
    high: "Prazer",
    levels: ["muito desagradável", "desagradável", "neutro", "agradável", "muito agradável"],
  },
  {
    id: "arousal",
    question: "Quão agitado ou calmo está seu corpo?",
    low: "Calma, sonolência",
    high: "Agitação, alerta",
    levels: ["muita calma", "calma", "neutro", "agitação", "muita agitação"],
  },
  {
    id: "dominance",
    question: "Quanto controle você sente ter?",
    low: "Pouco controle",
    high: "Muito controle",
    levels: ["pouquíssimo controle", "pouco controle", "neutro", "controle", "muito controle"],
  },
];

function pointLabel(scale: (typeof SAM_SCALES)[number], value: number) {
  const level = (value - 1) / 2;
  const name = Number.isInteger(level) ? scale.levels[level]! : `entre ${scale.levels[Math.floor(level)]} e ${scale.levels[Math.ceil(level)]}`;
  return `${value} de 9: ${name}`;
}

// The study's own figure: a paper index-card creature with a round head, drawn fresh for Archivist (not the
// original SAM drawings). `level` goes 0 (left end) to 4 (right end) on each dimension:
// - valence: the mouth bends from a frown to a smile, the brows from worried to raised, cheeks warm at the top;
// - arousal: the eyes go from shut to wide, with more and more motion strokes around the figure;
// - dominance: the figure grows from small and hunched to large with its arms open.
export function Manikin({ dimension, level }: { dimension: SamDimension; level: number }) {
  const t = level / 4;
  const scale = dimension === "dominance" ? 0.5 + 0.5 * t : 0.86;
  const mouthBend = dimension === "valence" ? -5 + 10 * t : 0;
  const eyeOpen = dimension === "arousal" ? t : 0.55;
  // Worried brows (inner ends up) at the unpleasant end, raised ones at the pleasant end.
  const browTilt = dimension === "valence" ? Math.max(0, 2.5 - 5 * t) : 0;
  const browLift = dimension === "valence" ? Math.max(0, 2 * t - 1) * 1.8 : 0;
  const armLift = dimension === "dominance" ? -6 + 16 * t : 2;
  const strokes = dimension === "arousal" ? [0, 0, 2, 4, 6][level]! : 0;

  // Drawn on a 48 × 64 box, standing on its baseline; scaled from the feet.
  const eye = (cx: number) =>
    eyeOpen < 0.15 ? (
      <path d={`M${cx - 2.2} 18 q2.2 1.6 4.4 0`} />
    ) : (
      <ellipse cx={cx} cy={18} rx={1.4 + eyeOpen * 0.9} ry={0.6 + eyeOpen * 2.1} className="manikin__fill-ink" />
    );

  return (
    <svg viewBox="0 0 48 64" className="manikin" aria-hidden="true" focusable="false">
      <g transform={`translate(24 62) scale(${scale}) translate(-24 -62)`}>
        {/* motion strokes */}
        {Array.from({ length: strokes }, (_, i) => {
          const side = i % 2 === 0 ? -1 : 1;
          const row = Math.floor(i / 2);
          const x = 24 + side * (17 + row * 1.5);
          const y = 14 + row * 12;
          return <path key={i} d={`M${x} ${y} l${side * 4} ${-2 + row}`} className="manikin__motion" />;
        })}
        {/* arms */}
        <path d={`M14 35 L${7 - (armLift > 4 ? 2 : 0)} ${44 - armLift}`} />
        <path d={`M34 35 L${41 + (armLift > 4 ? 2 : 0)} ${44 - armLift}`} />
        {/* body: an index card with a folded corner */}
        <path d="M13 30 h18 l4 4 v24 a2 2 0 0 1 -2 2 h-20 a2 2 0 0 1 -2 -2 v-26 a2 2 0 0 1 2 -2 z" className="manikin__fill-paper" />
        <path d="M31 30 v4 h4" />
        <path d="M16 40 h12 M16 45 h14 M16 50 h9" className="manikin__lines" />
        {/* legs */}
        <path d="M19 60 v2 M29 60 v2" />
        {/* head */}
        <circle cx={24} cy={18} r={10.5} className="manikin__fill-paper" />
        {eye(20)}
        {eye(28)}
        <path d={`M17.5 ${13 + browTilt - browLift} Q19.5 ${12 - browLift * 1.4} 21.5 ${13 - browTilt * 0.3 - browLift}`} />
        <path d={`M30.5 ${13 + browTilt - browLift} Q28.5 ${12 - browLift * 1.4} 26.5 ${13 - browTilt * 0.3 - browLift}`} />
        {dimension === "arousal" ? (
          // calm: a soft line; agitated: an open round mouth
          t < 0.6 ? <path d="M21 23.5 h6" /> : <ellipse cx={24} cy={23.8} rx={1.6 + t} ry={1 + t * 1.2} className="manikin__fill-ink" />
        ) : (
          <path d={`M19.5 ${23.5 - mouthBend / 4} Q24 ${23.5 + mouthBend / 2} 28.5 ${23.5 - mouthBend / 4}`} />
        )}
        {dimension === "valence" && level === 4 && (
          <>
            <circle cx={17} cy={21.5} r={1.6} className="manikin__cheek" />
            <circle cx={31} cy={21.5} r={1.6} className="manikin__cheek" />
          </>
        )}
      </g>
    </svg>
  );
}

function SamScale({ scale, value, onChange }: { scale: (typeof SAM_SCALES)[number]; value: number | null; onChange: (value: number) => void }) {
  const questionId = `sam-${scale.id}`;
  return (
    <fieldset className="sam">
      <legend id={questionId} className="study__label">
        {scale.question}
      </legend>
      <div className="sam__row" role="radiogroup" aria-labelledby={questionId}>
        {Array.from({ length: 9 }, (_, i) => {
          const point = i + 1;
          const figure = i % 2 === 0;
          return (
            <label key={point} className={`sam__point${figure ? " sam__point--figure" : ""}`}>
              <input
                type="radio"
                name={questionId}
                value={point}
                checked={value === point}
                onChange={() => onChange(point)}
                aria-label={pointLabel(scale, point)}
              />
              {figure ? <Manikin dimension={scale.id} level={i / 2} /> : <span className="sam__dot" aria-hidden="true" />}
            </label>
          );
        })}
      </div>
      <div className="study__ends" aria-hidden="true">
        <span>{scale.low}</span>
        <span>{scale.high}</span>
      </div>
    </fieldset>
  );
}

function SamDialog({ moment, context }: { moment: SamMoment; context: StudyContext }) {
  const [values, setValues] = useState<Record<SamDimension, number | null>>({ valence: null, arousal: null, dominance: null });
  const [saving, setSaving] = useState(false);
  const complete = values.valence !== null && values.arousal !== null && values.dominance !== null;

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    try {
      await saveSam(moment, { valence: values.valence!, arousal: values.arousal!, dominance: values.dominance! }, context);
      closeStudyDialog();
      notify(moment === "antes" ? "Obrigado! Pode começar as tarefas." : "Obrigado! Respostas arquivadas.");
    } catch (err) {
      console.warn("Não foi possível guardar a resposta.", err);
      notify("Não foi possível guardar a resposta.");
      setSaving(false);
    }
  };

  return (
    <StudyCard title={moment === "antes" ? "Como você se sente agora?" : "E agora, depois das tarefas?"} labelId="sam-title" onCancel={closeStudyDialog} wide>
      <div className="study__body">
        <p className="dialog__message study__intro">
          Em cada fileira, toque na figura ou no ponto entre duas figuras que mais combina com o que você sente neste
          momento. Não há resposta certa.
        </p>
        {SAM_SCALES.map(scale => (
          <SamScale key={scale.id} scale={scale} value={values[scale.id]} onChange={value => setValues(current => ({ ...current, [scale.id]: value }))} />
        ))}
      </div>
      <div className="dialog__actions">
        <button type="button" className="dialog__button" onClick={closeStudyDialog}>
          Depois
        </button>
        <button type="button" className="dialog__button dialog__button--confirm" disabled={!complete || saving} onClick={submit}>
          Enviar
        </button>
      </div>
    </StudyCard>
  );
}
