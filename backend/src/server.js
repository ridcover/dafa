const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { testConnection } = require('./config/db');

// Import Routes
const authRoutes = require('./routes/auth');
const archivesRoutes = require('./routes/archives');
const settingsRoutes = require('./routes/settings');
const previewRoutes = require('./routes/preview');
const auditRoutes = require('./routes/audit');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Pastikan folder uploads utama ada
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Konfigurasi CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:5000'
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Perbolehkan untuk development lokal fleksibel
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  })
);

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'DAF Archive Backend - SMK Diponegoro Cipari',
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/archives', archivesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/preview', previewRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', usersRoutes);

// 404 Handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint '${req.originalUrl}' tidak ditemukan pada backend API.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan internal pada server.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 DAF Archive Backend running on http://localhost:${PORT}`);
  console.log(`🏫 Sistem Penyimpanan Arsip Digital SMK Diponegoro Cipari`);
  console.log(`=======================================================`);
  
  const isConnected = await testConnection();
  if (isConnected) {
    const { checkAndSyncAcademicYear } = require('./utils/academicYearAuto');
    await checkAndSyncAcademicYear();
  }
});
