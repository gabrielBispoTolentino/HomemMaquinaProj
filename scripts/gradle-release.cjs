// Runs the Gradle wrapper's assembleRelease in android/, by full path so it works from any shell.
const { execSync } = require('child_process');
const path = require('path');

const dir = path.join(__dirname, '..', 'android');
const wrapper = path.join(dir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
execSync(`"${wrapper}" assembleRelease`, { cwd: dir, stdio: 'inherit' });
