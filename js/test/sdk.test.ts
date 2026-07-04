import { describe, expect, it, vi } from "vitest";
import { MiningGameClient } from "../src/index.js";

const addresses = {
  registry: "0x0000000000000000000000000000000000000001" as const,
  toolNFT: "0x0000000000000000000000000000000000000002" as const,
  miningCore: "0x0000000000000000000000000000000000000003" as const,
  resourceToken: "0x0000000000000000000000000000000000000004" as const,
  rewardVault: "0x0000000000000000000000000000000000000005" as const
};

describe("MiningGameClient", () => {
  it("connects to a game from the registry", async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue({
        gameId: 1n,
        operator: "0x0000000000000000000000000000000000000010",
        factory: "0x0000000000000000000000000000000000000012",
        ...addresses,
        version: "0.1.0",
        status: 0,
        riskTag: "",
        exists: true
      })
    };

    const client = await MiningGameClient.connectGame(addresses.registry, 1n, {
      publicClient: publicClient as never
    });

    expect(client.addresses.toolNFT).toBe(addresses.toolNFT);
    expect(client.addresses.gameId).toBe(1n);
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: addresses.registry,
        functionName: "getGame",
        args: [1n]
      })
    );
  });

  it("connects to the latest recommended game", async () => {
    const publicClient = {
      readContract: vi
        .fn()
        .mockResolvedValueOnce([2n, "ipfs://migration-v2"])
        .mockResolvedValueOnce([0n, ""])
        .mockResolvedValueOnce({
          gameId: 2n,
          operator: "0x0000000000000000000000000000000000000010",
          factory: "0x0000000000000000000000000000000000000012",
          ...addresses,
          version: "0.2.0",
          status: 0,
          riskTag: "",
          exists: true
        })
    };

    const client = await MiningGameClient.connectLatestGame(addresses.registry, 1n, {
      publicClient: publicClient as never
    });

    expect(client.addresses.gameId).toBe(2n);
    expect(publicClient.readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        functionName: "getRecommendedUpgrade",
        args: [1n]
      })
    );
  });

  it("reads full tool status", async () => {
    const publicClient = {
      readContract: vi
        .fn()
        .mockResolvedValueOnce([1n, 100n, 110n, 200n, 10n, 5n, 2n, 120n])
        .mockResolvedValueOnce("0x0000000000000000000000000000000000000011")
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(20n)
    };
    const client = new MiningGameClient(addresses, { publicClient: publicClient as never });

    const status = await client.getToolStatus(7n);

    expect(status).toMatchObject({
      toolType: 1n,
      power: 10n,
      durability: 5n,
      level: 2n,
      active: true,
      canMine: true,
      pendingReward: 20n
    });
  });

  it("writes transactions through the wallet client", async () => {
    const walletClient = {
      writeContract: vi.fn().mockResolvedValue("0xabc")
    };
    const client = new MiningGameClient(addresses, {
      publicClient: { readContract: vi.fn() } as never,
      walletClient: walletClient as never
    });

    await expect(client.mine(9n)).resolves.toBe("0xabc");
    expect(walletClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: addresses.miningCore,
        functionName: "mine",
        args: [9n]
      })
    );
  });

  it("requires a wallet client for writes", async () => {
    const client = new MiningGameClient(addresses, {
      publicClient: { readContract: vi.fn() } as never
    });

    await expect(client.mine(1n)).rejects.toThrow("walletClient is required");
  });
});
