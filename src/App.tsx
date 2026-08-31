import { useState } from "react";
import "./index.css";
import Cadastrar from "./pages/Cadastrar.tsx";
import Login from "./pages/Login.tsx";
import MainPen from "./pages/MainPen.tsx";

export type Screen = "main" | "login" | "cadastro";

export function App() {
  const [screen, setScreen] = useState<Screen>("main");

  if (screen === "login") {
    return <Login onGoToCadastro={() => setScreen("cadastro")} onBack={() => setScreen("main")} />;
  }

  if (screen === "cadastro") {
    return <Cadastrar onBack={() => setScreen("login")} onGoToLogin={() => setScreen("login")} />;
  }

  return <MainPen onEntrar={() => setScreen("login")} onGoToCadastro={() => setScreen("cadastro")} />;
}

export default App;
