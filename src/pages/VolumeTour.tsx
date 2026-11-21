import { useEffect, useRef, useState } from "react";
import "./CSS/Dialogs.css";

// The short tour shown the first time a volume opens on this device: what the archive's words mean (volume,
// verbete, subgrupo, categoria) and where Recursos and Ajuda are. Laid over the volume like a confirmation card,
// not pinned to buttons, so it reads the same on a phone. Neutral for research and creative work alike.
const STEPS = [
  {
    title: "Este é um volume",
    text: "Um volume guarda um trabalho inteiro: um livro, uma pesquisa, um mundo ou uma campanha. Tudo o que você escrever aqui fica neste volume, e a lista dele fica à esquerda.",
  },
  {
    title: "Cada texto é um verbete",
    text: "Um verbete é como uma ficha de arquivo: um capítulo, um personagem, uma fonte, um conceito. Crie um com “+ Verbete”, embaixo da lista. Tudo é arquivado sozinho enquanto você escreve.",
  },
  {
    title: "Subgrupos e categorias",
    text: "Subgrupos são divisórias para organizar os verbetes, como capítulos ou seções; arraste para mudar a ordem. Categorias são etiquetas coloridas, para filtrar a lista.",
  },
  {
    title: "Recursos e ajuda",
    text: "Em “⚙ Recursos” você liga e desliga as ferramentas deste volume. O botão ?, no alto da lista, explica tudo a qualquer momento.",
  },
];

type VolumeTourProps = {
  onClose: () => void;
};

export default function VolumeTour({ onClose }: VolumeTourProps) {
  const [step, setStep] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const last = step === STEPS.length - 1;
  const current = STEPS[step]!;

  // The cursor stays on "Próximo", so Enter walks through the tour.
  useEffect(() => {
    nextRef.current?.focus();
  }, [step]);

  return (
    <div className="dialog-backdrop">
      <section
        className="dialog tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "Tab") {
            // Only the card's own buttons take the cursor while it's open.
            const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
            const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
            event.preventDefault();
            buttons[(at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
          }
        }}
      >
        <p className="tour__step">
          {step + 1} de {STEPS.length}
        </p>
        {/* Remounted on each step, so the card's text comes in like a new page. */}
        <div key={step} className="tour__page">
          <h2 id="tour-title" className="dialog__title">
            {current.title}
          </h2>
          <p id="tour-text" className="dialog__message">
            {current.text}
          </p>
        </div>
        <div className="dialog__actions">
          {!last && (
            <button type="button" className="dialog__button" onClick={onClose}>
              Pular
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            className="dialog__button dialog__button--confirm"
            onClick={() => (last ? onClose() : setStep(step + 1))}
          >
            {last ? "Começar" : "Próximo"}
          </button>
        </div>
      </section>
    </div>
  );
}
