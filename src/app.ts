import "express-async-errors";
import express from "express";
import { router } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { requestMetrics } from "./middlewares/metricsMiddleware";

const app = express();

app.use(express.json());
app.use(requestMetrics); // Middlewares de métricas globais

app.use(router);

app.use(errorHandler); // Tratamento global de erros deve vir no final

export { app };
