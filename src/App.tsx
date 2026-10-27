import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";
import "./index.css";
import Cadastrar from "./pages/Cadastrar.tsx";
import Login from "./pages/Login.tsx";
import MainPen from "./pages/MainPen.tsx";
import type { WorldItem } from "./lib/worlds";
import WorldList from "./pages/WorldList.tsx";
import WorldNotes from "./pages/WorldNotes.tsx";

export type Screen = "main" | "login" | "cadastro" | "worlds" | "notes";

type LoggedUser = {
  id: number;
  name: string;
  email: string;
};

// Where the back button leads from each screen; main has no parent.
const parentScreen: Record<Screen, Screen | null> = {
  main: null,
  login: "main",
  cadastro: "main",
  worlds: "main",
  notes: "worlds",
};

export function App() {
  const [screen, setScreen] = useState<Screen>("main");
  const [currentUser, setCurrentUser] = useState<LoggedUser | null>(null);
  const [currentWorld, setCurrentWorld] = useState<WorldItem | null>(null);
  // Set by the volume screen, which handles back itself while its sidebar or a note is open.
  const volumeBack = useRef<(() => boolean) | null>(null);

  // Android hardware back button: go up one screen, or exit from the main screen.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener("backButton", () => {
      if (screen === "notes" && volumeBack.current?.()) return;

      const parent = parentScreen[screen];
      if (parent) {
        setScreen(parent);
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [screen]);

  if (screen === "login") {
    return (
      <Login
        onGoToCadastro={() => setScreen("cadastro")}
        onBack={() => setScreen("main")}
        onLoginSuccess={user => {
          setCurrentUser(user);
          setScreen("worlds");
        }}
      />
    );
  }

  if (screen === "cadastro") {
    return <Cadastrar onBack={() => setScreen("main")} onGoToLogin={() => setScreen("login")} />;
  }

  if (screen === "notes" && currentWorld) {
    return (
      <WorldNotes
        world={currentWorld}
        onBack={() => setScreen("worlds")}
        backHandler={volumeBack}
      />
    );
  }

  if (screen === "worlds") {
    return (
      <WorldList
        user={currentUser}
        onBack={() => setScreen("main")}
        onOpenWorld={world => {
          setCurrentWorld(world);
          setScreen("notes");
        }}
      />
    );
  }

  return <MainPen onEntrar={() => setScreen("login")} onGoToCadastro={() => setScreen("cadastro")} />;
}

export default App;
