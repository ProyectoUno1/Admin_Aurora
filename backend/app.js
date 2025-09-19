import express from "express";
import cors from "cors";
import adminRegisterRoutes from "./routes/adminRegister.js";
import adminLoginRoutes from "./routes/adminLogin.js";
import psychologistRoutes from "./routes/psychologistRoutes.js";
import adminSetupRoutes from "./routes/adminSetup.js";

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

const corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Origin",
    "X-Requested-With",
    "Accept",
  ],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use((req, res, next) => {
  if (req.method !== "OPTIONS") {
    console.log(
      `${req.method} ${req.path} - Origin: ${req.get("Origin") || "none"}`
    );
  }
  next();
});

app.get("/", (req, res) => {
  res.send("Aurora Backend funcionando en modo DESARROLLO!");
});

// Rutas de administradores
app.use("/api/admin", adminRegisterRoutes);

// Rutas de login
app.use("/api/login", adminLoginRoutes);

// Rutas de configuración de admin
app.use("/api/setup", adminSetupRoutes);

// Rutas de psicólogos
app.use("/api", psychologistRoutes);

app.use((req, res) => {
  console.log(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res
    .status(404)
    .json({ error: `Ruta ${req.method} ${req.originalUrl} no encontrada` });
});

app.use((error, req, res, next) => {
  console.error("Error global capturado:", error);
  res.status(error.status || 500).json({
    error: error.message || "Internal server error",
  });
});

export default app;
