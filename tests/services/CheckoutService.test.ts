import { CheckoutService } from "../../src/services/CheckoutService";
import { redis } from "../../src/config/redis";
import { AppDataSource } from "../../src/config/database";
import { Order } from "../../src/entities/Order";

jest.mock("../../src/config/redis", () => ({
  redis: {
    eval: jest.fn(),
  },
}));

jest.mock("../../src/config/database", () => {
  return {
    AppDataSource: {
      getRepository: jest.fn(),
    },
  };
});

describe("CheckoutService", () => {
  let checkoutService: CheckoutService;
  let mockOrderRepository: any;

  beforeEach(() => {
    checkoutService = new CheckoutService();
    mockOrderRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockOrderRepository);
    jest.clearAllMocks();
  });

  it("should process checkout successfully when tickets are available", async () => {
    // Mock do redis.eval para retornar 1 (sucesso na subtração)
    (redis.eval as jest.Mock).mockResolvedValue(1);
    
    mockOrderRepository.create.mockReturnValue({
      id: "mocked-uuid",
      eventId: "event1",
      userId: "user1",
      quantity: 2,
      status: "confirmed",
    });

    const order = await checkoutService.processCheckout("event1", "user1", 2);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(mockOrderRepository.create).toHaveBeenCalledWith({
      eventId: "event1",
      userId: "user1",
      quantity: 2,
      status: "confirmed",
    });
    expect(mockOrderRepository.save).toHaveBeenCalledTimes(1);
    expect(order.status).toBe("confirmed");
  });

  it("should throw an error when tickets are sold out or insufficient", async () => {
    // Mock do redis.eval para retornar 0 (falha)
    (redis.eval as jest.Mock).mockResolvedValue(0);

    await expect(checkoutService.processCheckout("event1", "user1", 5))
      .rejects.toThrow("Tickets sold out or insufficient quantity");

    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(mockOrderRepository.create).not.toHaveBeenCalled();
    expect(mockOrderRepository.save).not.toHaveBeenCalled();
  });
});
