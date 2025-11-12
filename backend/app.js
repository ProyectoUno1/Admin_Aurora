import express from "express";
import cors from "cors";
import adminRegisterRoutes from './routes/adminRegister.js';
import adminLoginRoutes from './routes/adminLogin.js';
import psychologistRoutes from './routes/psychologistRoutes.js';
import adminArticleRoutes from './routes/adminArticleRoutes.js';
import adminPatientRoutes from './routes/adminPatientRoutes.js';
import adminAppointmentRoutes from './routes/adminAppointmentRoutes.js';
import adminStripeRouter from './routes/adminStripeRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import adminSupportRoutes from './routes/adminSupportRoutes.js';
import bankInfoRoutes from './routes/bankInfoRoutes.js';
import adminPaymentRoutes from './routes/adminPaymentRoutes.js'; // ⭐ NUEVO

const app = express();

const corsOptions = {
  origin: true, 
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT','PATCH','DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));

app.use(express.json());

app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') { 
    console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
  }
  next();
});

// ==================== RUTAS PÚBLICAS ====================
app.get("/", (req, res) => {
  res.send("Aurora Backend funcionando en modo DESARROLLO!");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// ==================== RUTAS DE AUTENTICACIÓN ====================
app.use('/api/admin', adminRegisterRoutes);
app.use('/api/login', adminLoginRoutes);

// ==================== RUTAS DE PSICÓLOGOS ====================
app.use('/api', psychologistRoutes);

// ==================== RUTAS DE ADMINISTRACIÓN ====================
app.use('/api/admin', adminArticleRoutes);
app.use('/api/admin', adminPatientRoutes); 
app.use('/api/admin', adminAppointmentRoutes);
app.use('/api/admin', adminPaymentRoutes); // ⭐ NUEVO - Gestión de pagos a psicólogos

// Información bancaria de psicólogos
app.use('/api', bankInfoRoutes);

// Reembolsos y operaciones avanzadas con Stripe
app.use('/api/admin/stripe', adminStripeRouter);

// ==================== RUTAS DE ESTADÍSTICAS Y SOPORTE ====================
app.use('/api/stats', statsRoutes); 
app.use('/api/support', adminSupportRoutes);

// ==================== MANEJO DE RUTAS NO ENCONTRADAS ====================
app.use((req, res) => {
  console.log(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: `Ruta ${req.method} ${req.originalUrl} no encontrada`,
    timestamp: new Date().toISOString()
  });
});

// ==================== MANEJO GLOBAL DE ERRORES ====================
app.use((error, req, res, next) => {
  console.error("Error global capturado:", error);
  res.status(error.status || 500).json({
    error: error.message || "Internal server error",
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
});

export default app;