import express from "express";
import * as fs from "fs";
import cors from "cors";
import path from "path";
import checklistsRouter from "./routes/checklists.js";
import inspectionsRouter from "./routes/inspections.js";
import defectsRouter from "./routes/defects.js";
import photosRouter from "./routes/photos.js";
import usersRouter from "./routes/users.js";
import versionsRouter from "./routes/versions.js";

const app = express();
const port = parseInt(process.env.PORT || '9091', 10);

// Trust proxy - 确保在反向代理后面时 req.protocol 返回正确的协议
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve web app static files
// Production: /opt/bytefaas/client/dist, Development: relative path
const isProduction = process.env.NODE_ENV === 'production';
const clientDistPath = isProduction
  ? '/opt/bytefaas/client/dist'
  : path.join(process.cwd(), '..', 'client', 'dist');
console.log('[Static Files] Using path:', clientDistPath, 'isProd:', isProduction);

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  console.log('[Static Files] Served from:', clientDistPath);
} else {
  console.warn('[Static Files] Client dist not found at:', clientDistPath);
}

// Serve uploaded files as static
// 同时使用项目目录和 /tmp 目录，确保已有照片和新上传的照片都能访问
const projectUploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(projectUploadsPath));
if (isProduction) {
  // Production: also serve from /tmp/uploads for newly uploaded files
  app.use('/uploads', express.static('/tmp/uploads'));
}

// Health check
app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/checklists', checklistsRouter);
app.use('/api/v1/inspections', inspectionsRouter);
app.use('/api/v1/defects', defectsRouter);
app.use('/api/v1/photos', photosRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/auth', usersRouter);
app.use('/api/v1/versions', versionsRouter);

// Catch-all: serve index.html for client-side routing
app.get('*', (req, res) => {
  if (isProduction && fs.existsSync(path.join(clientDistPath, 'index.html'))) {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`[Env] NODE_ENV=${process.env.NODE_ENV}`);
});
