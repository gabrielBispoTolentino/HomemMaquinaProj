import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import "./index.css";
import Cadastrar from "./pages/Cadastrar.tsx";
import Login from "./pages/Login.tsx";
import MainPen from "./pages/MainPen.tsx";
import WorldList from "./pages/WorldList.tsx";

export type Screen = "main" | "login" | "cadastro" | "worlds";

type LoggedUser = {
  id: number;
  name: string;
  email: string;
};

export function App() {
  const [screen, setScreen] = useState<Screen>("main");
  const [currentUser, setCurrentUser] = useState<LoggedUser | null>(null);

  // Android hardware back button: return to the main screen, or exit from it.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener("backButton", () => {
      if (screen === "main") {
        CapacitorApp.exitApp();
      } else {
        setScreen("main");
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

  if (screen === "worlds") {
    return <WorldList user={currentUser} onBack={() => setScreen("main")} />;
  }

  return <MainPen onEntrar={() => setScreen("login")} onGoToCadastro={() => setScreen("cadastro")} />;
}

export default App;
