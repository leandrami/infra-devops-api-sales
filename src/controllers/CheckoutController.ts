import { Request, Response } from "express";
import { CheckoutService } from "../services/CheckoutService";

export class CheckoutController {
  private checkoutService = new CheckoutService();

  async handle(req: Request, res: Response): Promise<Response> {
    const { eventId, userId, quantity } = req.body;

    if (!eventId || !userId || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const order = await this.checkoutService.processCheckout(eventId, userId, quantity);
      return res.status(201).json({ message: "Checkout successful", order });
    } catch (error: any) {
      if (error.message === "Tickets sold out or insufficient quantity") {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
  }
}
