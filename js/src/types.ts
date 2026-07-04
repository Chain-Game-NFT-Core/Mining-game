import type { Abi, Account, Address, Chain, PublicClient, Transport, WalletClient } from "viem";

export type KernelAddresses = {
  gameId?: bigint;
  toolNFT: Address;
  miningCore: Address;
  resourceToken: Address;
  rewardVault?: Address;
  registry?: Address;
};

export type KernelClients = {
  publicClient: PublicClient<Transport, Chain | undefined>;
  walletClient?: WalletClient<Transport, Chain | undefined, Account | undefined>;
};

export type GameRecord = {
  gameId: bigint;
  operator: Address;
  factory: Address;
  toolNFT: Address;
  miningCore: Address;
  resourceToken: Address;
  rewardVault: Address;
  version: string;
  status: number;
  riskTag: string;
  exists: boolean;
};

export type ProtocolRelease = {
  version: string;
  factory: Address;
  metadataURI: string;
  active: boolean;
  exists: boolean;
};

export type RecommendedUpgrade = {
  fromGameId: bigint;
  toGameId: bigint;
  migrationURI: string;
  hasUpgrade: boolean;
};

export type ToolStatus = {
  toolType: bigint;
  owner: Address;
  mintedAt: bigint;
  activatedAt: bigint;
  expireAt: bigint;
  power: bigint;
  durability: bigint;
  level: bigint;
  lastUsedAt: bigint;
  active: boolean;
  canMine: boolean;
  pendingReward: bigint;
};

export type ToolType = {
  price: bigint;
  maxSupply: bigint;
  minted: bigint;
  power: bigint;
  durability: bigint;
  metadataURI: string;
  exists: boolean;
};

export type ConfigureToolTypeInput = {
  toolType: bigint;
  price: bigint;
  maxSupply: bigint;
  power: bigint;
  durability: bigint;
  metadataURI: string;
};

export type EventHandlers = Partial<{
  mined: (log: unknown) => void;
  toolMinted: (log: unknown) => void;
  toolActivated: (log: unknown) => void;
  resourceMinted: (log: unknown) => void;
  resourceBurned: (log: unknown) => void;
  toolUpgraded: (log: unknown) => void;
}>;

export type AbiMap = Record<string, Abi>;
