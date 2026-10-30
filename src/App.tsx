import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import "./index.css";
import "./pages/CSS/Motion.css";
import { signOut, type LoggedUser } from "./lib/auth";
import { endSyncSession, setSyncEnabled, startSyncSession } from "./lib/sync";
import Cadastrar from "./pages/Cadastrar.tsx";
import { closeOpenDialog, DialogHost } from "./pages/Dialogs.tsx";
import Login from "./pages/Login.tsx";
import MainPen from "./pages/MainPen.tsx";
import SyncChoice from "./pages/SyncChoice.tsx";
import type { WorldItem } from "./lib/worlds";
import WorldList from "./pages/WorldList.tsx";
import WorldNotes from "./pages/WorldNotes.tsx";

export type Screen = "main" | "login" | "cadastro" | "sync" | "worlds" | "notes";

// Where the back button leads from each screen; main has no parent.
const parentScreen: Record<Screen, Screen | null> = {
  main: null,
  login: "main",
  cadastro: "main",
  sync: "main",
  worlds: "main",
  notes: "worlds",
};

// Changes screen inside a View Transition where the browser has them: the old screen crossfades into the new one,
// and a volume's divider grows into the open volume's band (both are named "volume-band", see Motion.css).
function withTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown };
  if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}

export function App() {
  const [screen, setScreenNow] = useState<Screen>("main");
  const setScreen = (next: Screen) => withTransition(() => setScreenNow(next));
  const [currentUser, setCurrentUser] = useState<LoggedUser | null>(null);
  const [currentWorld, setCurrentWorld] = useState<WorldItem | null>(null);
  // Set by the volume screen, which handles back itself while its sidebar or a note is open.
  const volumeBack = useRef<(() => boolean) | null>(null);

  const logIn = async (user: LoggedUser) => {
    setCurrentUser(user);
    // The first login on this device asks whether to sync; after that it goes straight to the volumes.
    const choice = await startSyncSession(user.id);
    setScreen(choice === null ? "sync" : "worlds");
  };

  const goToScreen = (next: Screen) =>
    withTransition(() => {
      // Back to the main screen is a logout.
      if (next === "main" && currentUser) {
        endSyncSession();
        void signOut();
        setCurrentUser(null);
        setCurrentWorld(null);
      }
      setScreenNow(next);
    });

  // Android hardware back button: go up one screen, or exit from the main screen.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener("backButton", () => {
      // An open confirmation is closed first, as a cancel.
      if (closeOpenDialog()) return;
      if (screen === "notes" && volumeBack.current?.()) return;

      const parent = parentScreen[screen];
      if (parent) {
        goToScreen(parent);
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [screen, currentUser]);

  return (
    <>
      {renderScreen()}
      <DialogHost />
    </>
  );

  function renderScreen(): ReactNode {
    if (screen === "login") {
      return (
        <Login
          onGoToCadastro={() => setScreen("cadastro")}
          onBack={() => setScreen("main")}
          onLoginSuccess={logIn}
        />
      );
    }

    if (screen === "sync" && currentUser) {
      return (
        <SyncChoice
          userName={currentUser.name}
          onBack={() => goToScreen("main")}
          onChoose={async enabled => {
            await setSyncEnabled(currentUser.id, enabled);
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
          onDeleted={() =>
            withTransition(() => {
              setCurrentWorld(null);
              setScreenNow("worlds");
            })
          }
          backHandler={volumeBack}
        />
      );
    }

    if (screen === "worlds") {
      return (
        <WorldList
          user={currentUser}
          onBack={() => goToScreen("main")}
          onOpenWorld={world =>
            withTransition(() => {
              setCurrentWorld(world);
              setScreenNow("notes");
            })
          }
        />
      );
    }

    return <MainPen onEntrar={() => setScreen("login")} onGoToCadastro={() => setScreen("cadastro")} />;
  }
}

export default App;
