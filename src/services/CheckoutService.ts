import { redis } from "../config/redis";
import { AppDataSource } from "../config/database";
import { Order } from "../entities/Order";

export class CheckoutService {

  async processCheckout(eventId: string, userId: string, quantity: number): Promise<Order> {
    const redisKey = `event:${eventId}:tickets`;

    const luaScript = `
      local current_tickets = tonumber(redis.call("GET", KEYS[1]))
      local requested_tickets = tonumber(ARGV[1])
      
      -- Se a chave não existir, podemos assumir que esgotou ou não foi inicializada
      if not current_tickets then
        return 0
      end

      if current_tickets >= requested_tickets then
        redis.call("DECRBY", KEYS[1], requested_tickets)
        return 1
      else
        return 0
      end
    `;

    const result = await redis.eval(luaScript, 1, redisKey, quantity);

    if (result === 0) {
      throw new Error("Tickets sold out or insufficient quantity");
    }

    const orderRepo = AppDataSource.getRepository(Order);

    const order = orderRepo.create({
      eventId,
      userId,
      quantity,
      status: "confirmed",
    });

    await orderRepo.save(order);

    return order;
  }
}
