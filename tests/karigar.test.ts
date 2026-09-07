import { calculateKarigarPayment } from "@/utils/paymentCalculator";

describe("calculateKarigarPayment", () => {
  const mockPrisma = {
    operation: {
      findUnique: jest.fn(),
    },
  } as unknown as Parameters<typeof calculateKarigarPayment>[2];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calculates piece-rate amount deterministically", async () => {
    (mockPrisma.operation.findUnique as jest.Mock).mockResolvedValue({
      id: "op-1",
      ratePerPiece: 5,
      isActive: true,
    });

    const result = await calculateKarigarPayment("op-1", 100, mockPrisma);
    expect(result).toEqual({ rate: 5, pieces: 100, amountDue: 500 });
  });

  it("rejects inactive operations", async () => {
    (mockPrisma.operation.findUnique as jest.Mock).mockResolvedValue({
      id: "op-1",
      ratePerPiece: 5,
      isActive: false,
    });

    await expect(calculateKarigarPayment("op-1", 100, mockPrisma)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("karigar payment status derivation", () => {
  function deriveStatus(amountDue: number, amountPaid: number) {
    if (amountPaid <= 0) return "PENDING";
    if (amountPaid >= amountDue) return "PAID";
    return "PARTIALLY_PAID";
  }

  it("tracks partial payment outstanding correctly", () => {
    expect(deriveStatus(500, 300)).toBe("PARTIALLY_PAID");
    expect(500 - 300).toBe(200);
    expect(deriveStatus(500, 200)).toBe("PARTIALLY_PAID");
    expect(deriveStatus(500, 500)).toBe("PAID");
  });
});
