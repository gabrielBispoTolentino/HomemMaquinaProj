import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { notify } from "../pages/Dialogs";

// New versions are the releases of the app's public GitHub repository, tagged vX.Y.Z, carrying
// Archivist-Setup-X.Y.Z.exe (Windows) and Archivist-X.Y.Z.apk (Android); see scripts/release.cjs. At start the app
// asks GitHub for the latest one (nothing about the user is sent) and, if it's newer, offers it in a notice:
// Windows downloads and installs it and reopens (main.cjs); Android opens the APK in the browser, since a sideloaded
// app can't replace itself without the user confirming the install.
export const RELEASES_REPO = "gabrielBispoTolentino/HomemMaquinaProj";
const LATEST_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;

type Release = { tag_name: string; assets: { name: string; browser_download_url: string }[] };

// Set by preload.cjs in the installed Windows app only.
type DesktopUpdater = { version: string; install: (url: string) => Promise<void> };

function parseVersion(value: string) {
  const parts = value.replace(/^v/, "").split(/[.-]/).slice(0, 3).map(Number);
  return parts.length === 3 && parts.every(Number.isInteger) ? parts : null;
}

function isNewer(latest: number[], current: number[]) {
  for (let i = 0; i < 3; i++) {
    if (latest[i] !== current[i]) return latest[i]! > current[i]!;
  }
  return false;
}

async function currentVersion(desktop: DesktopUpdater | undefined) {
  if (desktop) return desktop.version;
  if (Capacitor.getPlatform() === "android") return (await CapacitorApp.getInfo()).version;
  return null;
}

let checked = false;

// Once per launch. Any failure (offline, GitHub down) just means no notice this time.
export async function checkForUpdates() {
  if (checked) return;
  checked = true;
  const desktop = (window as { __UPDATER__?: DesktopUpdater }).__UPDATER__;
  try {
    const installed = await currentVersion(desktop);
    const current = installed ? parseVersion(installed) : null;
    if (!current) return;

    const response = await fetch(LATEST_URL, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) return;
    const release = (await response.json()) as Release;
    const latest = parseVersion(release.tag_name);
    if (!latest || !isNewer(latest, current)) return;

    const version = latest.join(".");
    const suffix = desktop ? ".exe" : ".apk";
    const asset = release.assets.find(item => item.name.toLowerCase().endsWith(suffix));
    if (!asset) return;

    if (desktop) {
      notify(`Nova versão ${version} disponível.`, {
        label: "Atualizar",
        run: async () => {
          notify(`Baixando a versão ${version}… O Archivist fecha e abre de novo sozinho.`);
          try {
            await desktop.install(asset.browser_download_url);
          } catch {
            notify("Não foi possível baixar a atualização. Ela será oferecida de novo na próxima vez.");
          }
        },
      });
    } else {
      notify(`Nova versão ${version} disponível.`, {
        label: "Baixar",
        // A link outside the app opens in the system browser, which downloads the APK; opening it installs.
        run: () => {
          window.location.href = asset.browser_download_url;
        },
      });
    }
  } catch (err) {
    console.warn("Não foi possível procurar atualizações.", err);
  }
}
