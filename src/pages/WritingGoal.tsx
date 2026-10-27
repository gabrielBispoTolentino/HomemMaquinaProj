import { useRef, useState } from "react";
import { formatWords, type WritingStats } from "../lib/writing";
import "./CSS/Writing.css";

type WritingGoalProps = {
  stats: WritingStats;
  onSetGoal: (goal: number | null) => void;
};

// Today's words in the volume, under the sidebar's band: progress towards the daily goal and the streak.
export default function WritingGoal({ stats, onSetGoal }: WritingGoalProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(stats.goal ? String(stats.goal) : "");
  const cancel = useRef(false);
  const { goal, today, streak } = stats;
  const progress = goal ? Math.min(1, Math.max(0, today) / goal) : 0;

  // Blank or zero clears the goal.
  const commit = () => {
    setEditing(false);
    if (cancel.current) {
      cancel.current = false;
      return;
    }
    const parsed = Number.parseInt(value, 10);
    onSetGoal(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  };

  return (
    <div className="goal">
      <div className="goal__line">
        <span className="goal__today">
          Hoje: {goal ? `${Math.max(0, today).toLocaleString("pt-BR")} de ${formatWords(goal)}` : formatWords(Math.max(0, today))}
        </span>
        {streak > 0 && (
          <span className="goal__streak" title="Dias seguidos cumprindo a meta">
            {streak === 1 ? "1 dia seguido" : `${streak} dias seguidos`}
          </span>
        )}
        {editing ? (
          <input
            className="goal__input"
            type="number"
            min={0}
            step={50}
            inputMode="numeric"
            value={value}
            onChange={event => setValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") event.currentTarget.blur();
              else if (event.key === "Escape") {
                cancel.current = true;
                event.currentTarget.blur();
              }
            }}
            onBlur={commit}
            aria-label="Meta diária de palavras"
            placeholder="Palavras"
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="goal__edit"
            onClick={() => {
              setValue(goal ? String(goal) : "");
              setEditing(true);
            }}
          >
            {goal ? "Meta" : "Definir meta"}
          </button>
        )}
      </div>
      {goal && (
        <div
          className="goal__bar"
          role="progressbar"
          aria-label="Meta diária"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.max(0, today)}
        >
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}
