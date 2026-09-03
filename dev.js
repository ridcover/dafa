const { spawn } = require('child_process');
const path = require('path');

console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('\x1b[32m%s\x1b[0m', '  🚀 Menjalankan DAF Archive (SMK Diponegoro Cipari)');
console.log('\x1b[36m%s\x1b[0m', '=====================================================');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// 1. Jalankan Backend (Port 5000)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Memulai server Express di port 5000...');
const backend = spawn(npmCmd, ['start'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  shell: true
});

// 2. Jalankan Frontend (Vite)
console.log('\x1b[35m%s\x1b[0m', '[Frontend] Memulai server Vite React...');
const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'frontend'),
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\n\x1b[31m%s\x1b[0m', 'Menghentikan seluruh server DAF Archive...');
  try {
    if (backend) backend.kill();
    if (frontend) frontend.kill();
  } catch (e) {}
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
