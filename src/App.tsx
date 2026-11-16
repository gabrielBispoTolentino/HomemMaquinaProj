import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import "./index.css";
import "./pages/CSS/Motion.css";
import { restoreUser, signOut, type LoggedUser } from "./lib/auth";
import { endSyncSession, setSyncEnabled, startSyncSession } from "./lib/sync";
import Cadastrar from "./pages/Cadastrar.tsx";
import { closeOpenDialog, DialogHost } from "./pages/Dialogs.tsx";
import Login from "./pages/Login.tsx";
import MainPen from "./pages/MainPen.tsx";
import SyncChoice from "./pages/SyncChoice.tsx";
import { loadWorlds, type WorldItem } from "./lib/worlds";
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

// The volume open when the app was last closed, per user, so the next start goes straight back to it (and the volume
// to its last note, see WorldNotes). Going back to the volume list forgets it.
const LAST_WORLD_KEY = (userId: number) => `archivist.lastWorld.${userId}`;

function lastWorldId(userId: number) {
  try {
    return localStorage.getItem(LAST_WORLD_KEY(userId));
  } catch {
    return null;
  }
}

function storeLastWorld(userId: number, worldId: string | null) {
  try {
    if (worldId) localStorage.setItem(LAST_WORLD_KEY(userId), worldId);
    else localStorage.removeItem(LAST_WORLD_KEY(userId));
  } catch {
    // Only a convenience: the next start opens on the volume list.
  }
}

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
  // While the start looks for a user still logged in, nothing is drawn, so the main screen doesn't flash by.
  const [restoring, setRestoring] = useState(true);
  // Set by the volume screen, which handles back itself while its sidebar or a note is open.
  const volumeBack = useRef<(() => boolean) | null>(null);

  const logIn = async (user: LoggedUser) => {
    setCurrentUser(user);
    // A fresh login starts on the volume list, not in a volume left open before the last logout.
    storeLastWorld(user.id, null);
    // The first login on this device asks whether to sync; after that it goes straight to the volumes.
    const choice = await startSyncSession(user.id);
    setScreen(choice === null ? "sync" : "worlds");
  };

  // At start: the last user still logged in goes straight back to the volume they had open, or to their volumes.
  useEffect(() => {
    const restore = async () => {
      try {
        const user = await restoreUser();
        if (!user) return;
        setCurrentUser(user);
        const choice = await startSyncSession(user.id);
        if (choice === null) {
          setScreenNow("sync");
          return;
        }
        const worldId = lastWorldId(user.id);
        const world = worldId ? (await loadWorlds(user.id)).find(item => item.id === worldId) : undefined;
        if (world) {
          setCurrentWorld(world);
          setScreenNow("notes");
        } else {
          if (worldId) storeLastWorld(user.id, null);
          setScreenNow("worlds");
        }
      } catch (err) {
        console.warn("Não foi possível reabrir a última sessão.", err);
      } finally {
        setRestoring(false);
      }
    };
    void restore();
  }, []);

  const openWorld = (world: WorldItem) =>
    withTransition(() => {
      if (currentUser) storeLastWorld(currentUser.id, world.id);
      setCurrentWorld(world);
      setScreenNow("notes");
    });

  // Leaving the volume for the list: the next start opens on the list too.
  const leaveWorld = (update: () => void) =>
    withTransition(() => {
      if (currentUser) storeLastWorld(currentUser.id, null);
      update();
    });

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
      if (screen === "notes") {
        leaveWorld(() => setScreenNow("worlds"));
      } else if (parent) {
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
      {!restoring && renderScreen()}
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
          onBack={() => leaveWorld(() => setScreenNow("worlds"))}
          onDeleted={() =>
            leaveWorld(() => {
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
          onOpenWorld={openWorld}
        />
      );
    }

    return <MainPen onEntrar={() => setScreen("login")} onGoToCadastro={() => setScreen("cadastro")} />;
  }
}

export default App;
