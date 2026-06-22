import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import cors from "cors";
import path from "path";
import checklistsRouter from "./routes/checklists.js";
import inspectionsRouter from "./routes/inspections.js";
import defectsRouter from "./routes/defects.js";
import photosRouter from "./routes/photos.js";
import usersRouter from "./routes/users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve web app static files (works from both server/ and project root)
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Serve uploaded files as static
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  // Production: use /tmp as writable directory
  app.use('/uploads', express.static('/tmp/uploads'));
} else {
  // Development: use project uploads directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
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

// Serve web app static files (SPA fallback)
app.use(express.static(clientDistPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
