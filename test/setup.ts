import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_URL = 'postgresql://railbridge:railbridge@127.0.0.1:5432/railbridge_test';
process.env.POSTGRES_READINESS_TIMEOUT_MS = '100';
