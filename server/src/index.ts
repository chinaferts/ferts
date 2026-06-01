import express from "express";
import cors from "cors";
import checklistsRouter from "./routes/checklists.js";
import inspectionsRouter from "./routes/inspections.js";
import defectsRouter from "./routes/defects.js";
import photosRouter from "./routes/photos.js";
import usersRouter from "./routes/users.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
