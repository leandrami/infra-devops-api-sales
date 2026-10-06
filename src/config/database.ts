import "reflect-metadata";
import { DataSource } from "typeorm";
import { Order } from "../entities/Order";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "flash_sales",
  synchronize: true,
  logging: false,
  entities: [Order],
  subscribers: [],
  migrations: [],
});
