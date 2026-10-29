import { useState } from "react";

type PasswordInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // "current-password" on login, "new-password" on sign-up, so password managers fill or suggest the right one.
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
};

// A password field with a button to show what was typed, so a typo can be caught before sending.
export default function PasswordInput({ id, value, onChange, autoComplete, describedBy }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-page__password">
      <input
        id={id}
        type={visible ? "text" : "password"}
        className="auth-page__input"
        value={value}
        onChange={event => onChange(event.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="off"
        spellCheck={false}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        className="auth-page__reveal"
        onClick={() => setVisible(!visible)}
        aria-pressed={visible}
        aria-controls={id}
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
