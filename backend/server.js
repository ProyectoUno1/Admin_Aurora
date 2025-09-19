import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Aurora Backend corriendo en http://localhost:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Emuladores: ${process.env.USE_EMULATORS === 'true' ? 'SÍ' : 'NO'}`);
});