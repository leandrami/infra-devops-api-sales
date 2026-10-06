import { Request, Response, NextFunction } from "express";
import client from "prom-client";

// Coleta as métricas padrão do Node.js (CPU, GC, Memória)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

// Cria um histograma para medir duração e contagem de requisições HTTP
const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [10, 50, 100, 300, 500, 1000, 2000, 5000],
});

export function requestMetrics(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    httpRequestDurationMicroseconds
      .labels(req.method, req.route ? req.route.path : req.path, res.statusCode.toString())
      .observe(duration);
  });
  
  next();
}

export async function metricsController(req: Request, res: Response) {
  res.set("Content-Type", client.register.contentType);
  const metrics = await client.register.metrics();
  res.end(metrics);
}
