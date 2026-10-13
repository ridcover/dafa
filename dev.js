const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const fs = require('fs');

console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('\x1b[32m%s\x1b[0m', '  🚀 Menjalankan DAF Archive (SMK Diponegoro Cipari)');
console.log('\x1b[36m%s\x1b[0m', '=====================================================');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

let backendProcess = null;
let frontendProcess = null;

// Fungsi untuk memeriksa ketersediaan port TCP
function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

// Memastikan database MySQL aktif sebelum backend dinyalakan
async function ensureMySQLRunning() {
  const isRunning = await checkPort(3306);
  if (isRunning) {
    console.log('\x1b[32m%s\x1b[0m', '  ✓ MySQL aktif di port 3306.');
    return;
  }

  console.log('\x1b[33m%s\x1b[0m', '  ⚠️ MySQL belum aktif di port 3306. Mencari instalasi XAMPP...');
  const xamppStartBat = 'C:\\xampp\\mysql_start.bat';
  const mysqldExe = 'C:\\xampp\\mysql\\bin\\mysqld.exe';

  if (fs.existsSync(xamppStartBat)) {
    console.log('\x1b[36m%s\x1b[0m', '  🚀 Menjalankan MySQL via ' + xamppStartBat + '...');
    spawn('cmd.exe', ['/c', xamppStartBat], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
  } else if (fs.existsSync(mysqldExe)) {
    console.log('\x1b[36m%s\x1b[0m', '  🚀 Menjalankan MySQL via ' + mysqldExe + '...');
    spawn(mysqldExe, ['--defaults-file=C:\\xampp\\mysql\\bin\\my.ini', '--standalone'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
  }

  // Tunggu maksimal 10 detik hingga port 3306 siap
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const ok = await checkPort(3306);
    if (ok) {
      console.log('\x1b[32m%s\x1b[0m', '  ✓ Layanan MySQL berhasil dinyalakan di port 3306.');
      return;
    }
  }
  console.log('\x1b[33m%s\x1b[0m', '  ⚠️ Menghubungkan ke backend... Pastikan layanan MySQL Anda aktif.');
}

async function startServers() {
  await ensureMySQLRunning();

  // 1. Jalankan Backend (Port 5000) dengan auto-reload watch mode
  console.log('\x1b[33m%s\x1b[0m', '[Backend] Memulai server Express di port 5000 (watch mode)...');
  backendProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit',
    shell: true
  });

  // 2. Jalankan Frontend (Vite)
  console.log('\x1b[35m%s\x1b[0m', '[Frontend] Memulai server Vite React...');
  frontendProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.join(__dirname, 'frontend'),
    stdio: 'inherit',
    shell: true
  });
}

function cleanup() {
  console.log('\n\x1b[31m%s\x1b[0m', 'Menghentikan seluruh server DAF Archive...');
  try {
    if (backendProcess) backendProcess.kill();
    if (frontendProcess) frontendProcess.kill();
  } catch (e) {}
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

startServers();
