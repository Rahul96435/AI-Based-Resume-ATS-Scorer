import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || null,
  modelServiceUrl: process.env.MODEL_SERVICE_URL || 'http://127.0.0.1:8001',
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me',
};
