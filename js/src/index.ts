import type { Address, ContractFunctionParameters, Hash } from "viem";
import { gameRegistryAbi, miningCoreAbi, resourceTokenAbi, toolNftAbi } from "./abis/index.js";
import type {
  EventHandlers,
  GameRecord,
  KernelAddresses,
  KernelClients,
  ProtocolRelease,
  RecommendedUpgrade,
  ConfigureToolTypeInput,
  ToolStatus,
  ToolType
} from "./types.js";

export * from "./abis/index.js";
export * from "./types.js";

export class MiningGameClient {
  readonly addresses: KernelAddresses;
  readonly publicClient: KernelClients["publicClient"];
  readonly walletClient: KernelClients["walletClient"];

  constructor(addresses: KernelAddresses, clients: KernelClients) {
    this.addresses = addresses;
    this.publicClient = clients.publicClient;
    this.walletClient = clients.walletClient;
  }

  static async connectGame(
    registry: Address,
    gameId: bigint,
    clients: KernelClients
  ): Promise<MiningGameClient> {
    const game = await MiningGameClient.getGameRecord(registry, gameId, clients);

    return new MiningGameClient(
      {
        gameId,
        registry,
        toolNFT: game.toolNFT,
        miningCore: game.miningCore,
        resourceToken: game.resourceToken,
        rewardVault: game.rewardVault
      },
      clients
    );
  }

  static async connectLatestGame(
    registry: Address,
    gameId: bigint,
    clients: KernelClients,
    maxHops = 8
  ): Promise<MiningGameClient> {
    let currentGameId = gameId;

    for (let i = 0; i < maxHops; i++) {
      const upgrade = await MiningGameClient.getRecommendedUpgrade(registry, currentGameId, clients);
      if (!upgrade.hasUpgrade) {
        break;
      }
      currentGameId = upgrade.toGameId;
    }

    return MiningGameClient.connectGame(registry, currentGameId, clients);
  }

  static async getGameRecord(
    registry: Address,
    gameId: bigint,
    clients: Pick<KernelClients, "publicClient">
  ): Promise<GameRecord> {
    return (await clients.publicClient.readContract({
      address: registry,
      abi: gameRegistryAbi,
      functionName: "getGame",
      args: [gameId]
    })) as GameRecord;
  }

  static async getRecommendedUpgrade(
    registry: Address,
    gameId: bigint,
    clients: Pick<KernelClients, "publicClient">
  ): Promise<RecommendedUpgrade> {
    const [toGameId, migrationURI] = await clients.publicClient.readContract({
      address: registry,
      abi: gameRegistryAbi,
      functionName: "getRecommendedUpgrade",
      args: [gameId]
    });

    return {
      fromGameId: gameId,
      toGameId,
      migrationURI,
      hasUpgrade: toGameId !== 0n
    };
  }

  static async getProtocolRelease(
    registry: Address,
    version: string,
    clients: Pick<KernelClients, "publicClient">
  ): Promise<ProtocolRelease> {
    return (await clients.publicClient.readContract({
      address: registry,
      abi: gameRegistryAbi,
      functionName: "getProtocolRelease",
      args: [version]
    })) as ProtocolRelease;
  }

  async getGameConfig(): Promise<KernelAddresses> {
    return this.addresses;
  }

  async getRecommendedUpgrade(gameId = this.addresses.gameId): Promise<RecommendedUpgrade> {
    if (!this.addresses.registry) {
      throw new Error("A registry address is required to read game upgrades.");
    }
    if (gameId === undefined) {
      throw new Error("A gameId is required to read game upgrades.");
    }
    return MiningGameClient.getRecommendedUpgrade(this.addresses.registry, gameId, {
      publicClient: this.publicClient
    });
  }

  async getToolType(toolType: bigint): Promise<ToolType> {
    const [price, maxSupply, minted, power, durability, metadataURI, exists] = await this.publicClient.readContract({
      address: this.addresses.toolNFT,
      abi: toolNftAbi,
      functionName: "toolTypes",
      args: [toolType]
    });
    return { price, maxSupply, minted, power, durability, metadataURI, exists };
  }

  async configureToolType(input: ConfigureToolTypeInput): Promise<Hash> {
    return this.write({
      address: this.addresses.toolNFT,
      abi: toolNftAbi,
      functionName: "configureToolType",
      args: [
        input.toolType,
        input.price,
        input.maxSupply,
        input.power,
        input.durability,
        input.metadataURI
      ]
    });
  }

  async getToolStatus(toolId: bigint): Promise<ToolStatus> {
    const [tool, owner, active, canMine, pendingReward] = await Promise.all([
      this.publicClient.readContract({
        address: this.addresses.toolNFT,
        abi: toolNftAbi,
        functionName: "tools",
        args: [toolId]
      }),
      this.publicClient.readContract({
        address: this.addresses.toolNFT,
        abi: toolNftAbi,
        functionName: "ownerOf",
        args: [toolId]
      }),
      this.publicClient.readContract({
        address: this.addresses.toolNFT,
        abi: toolNftAbi,
        functionName: "isActive",
        args: [toolId]
      }),
      this.canMine(toolId),
      this.getPendingReward(toolId)
    ]);

    const [toolType, mintedAt, activatedAt, expireAt, power, durability, level, lastUsedAt] = tool;
    return {
      toolType,
      owner,
      mintedAt,
      activatedAt,
      expireAt,
      power,
      durability,
      level,
      lastUsedAt,
      active,
      canMine,
      pendingReward
    };
  }

  async canMine(toolId: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.miningCore,
      abi: miningCoreAbi,
      functionName: "canMine",
      args: [toolId]
    });
  }

  async getPendingReward(toolId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.miningCore,
      abi: miningCoreAbi,
      functionName: "pendingReward",
      args: [toolId]
    });
  }

  async getResourceBalance(account: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.resourceToken,
      abi: resourceTokenAbi,
      functionName: "balanceOf",
      args: [account]
    });
  }

  async buyTool(toolType: bigint, value: bigint): Promise<Hash> {
    return this.write({
      address: this.addresses.toolNFT,
      abi: toolNftAbi,
      functionName: "buyTool",
      args: [toolType],
      value
    });
  }

  async mine(toolId: bigint): Promise<Hash> {
    return this.write({
      address: this.addresses.miningCore,
      abi: miningCoreAbi,
      functionName: "mine",
      args: [toolId]
    });
  }

  async mineBatch(toolIds: bigint[]): Promise<Hash> {
    return this.write({
      address: this.addresses.miningCore,
      abi: miningCoreAbi,
      functionName: "mineBatch",
      args: [toolIds]
    });
  }

  async approveResource(spender: Address, amount: bigint): Promise<Hash> {
    return this.write({
      address: this.addresses.resourceToken,
      abi: resourceTokenAbi,
      functionName: "approve",
      args: [spender, amount]
    });
  }

  async upgradeTool(toolId: bigint): Promise<Hash> {
    return this.write({
      address: this.addresses.miningCore,
      abi: miningCoreAbi,
      functionName: "upgradeTool",
      args: [toolId]
    });
  }

  watchEvents(handlers: EventHandlers) {
    const unwatchers = [
      handlers.mined
        ? this.publicClient.watchContractEvent({
            address: this.addresses.miningCore,
            abi: miningCoreAbi,
            eventName: "Mined",
            onLogs: (logs) => logs.forEach(handlers.mined!)
          })
        : undefined,
      handlers.toolMinted
        ? this.publicClient.watchContractEvent({
            address: this.addresses.toolNFT,
            abi: toolNftAbi,
            eventName: "ToolMinted",
            onLogs: (logs) => logs.forEach(handlers.toolMinted!)
          })
        : undefined,
      handlers.toolActivated
        ? this.publicClient.watchContractEvent({
            address: this.addresses.toolNFT,
            abi: toolNftAbi,
            eventName: "ToolActivated",
            onLogs: (logs) => logs.forEach(handlers.toolActivated!)
          })
        : undefined,
      handlers.resourceMinted
        ? this.publicClient.watchContractEvent({
            address: this.addresses.resourceToken,
            abi: resourceTokenAbi,
            eventName: "ResourceMinted",
            onLogs: (logs) => logs.forEach(handlers.resourceMinted!)
          })
        : undefined,
      handlers.resourceBurned
        ? this.publicClient.watchContractEvent({
            address: this.addresses.resourceToken,
            abi: resourceTokenAbi,
            eventName: "ResourceBurned",
            onLogs: (logs) => logs.forEach(handlers.resourceBurned!)
          })
        : undefined,
      handlers.toolUpgraded
        ? this.publicClient.watchContractEvent({
            address: this.addresses.toolNFT,
            abi: toolNftAbi,
            eventName: "ToolUpgraded",
            onLogs: (logs) => logs.forEach(handlers.toolUpgraded!)
          })
        : undefined
    ].filter((unwatch): unwatch is () => void => Boolean(unwatch));

    return () => unwatchers.forEach((unwatch) => unwatch());
  }

  private async write(parameters: ContractFunctionParameters & { value?: bigint }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error("A walletClient is required for write operations.");
    }
    return this.walletClient.writeContract(parameters as never);
  }
}

export const connectGame = MiningGameClient.connectGame;
export const connectLatestGame = MiningGameClient.connectLatestGame;
