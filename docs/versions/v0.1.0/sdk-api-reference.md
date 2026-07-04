# 游戏 API 与 SDK 函数参考

本文档说明 `@chain-game-nft-core/mining-game-sdk` 当前暴露的 TypeScript API、函数参数、返回值和事件监听方式。

SDK 基于 `viem`，所有链上数值使用 `bigint`，地址类型使用 `Address`。

## 1. 安装

```bash
npm install @chain-game-nft-core/mining-game-sdk viem
```

本仓库本地开发：

```bash
cd js
npm install
npm run build
npm test
```

## 2. 导入

```ts
import { MiningGameClient, connectGame } from "@chain-game-nft-core/mining-game-sdk";
import type {
  EventHandlers,
  GameRecord,
  KernelAddresses,
  KernelClients,
  ProtocolRelease,
  RecommendedUpgrade,
  ToolStatus,
  ToolType
} from "@chain-game-nft-core/mining-game-sdk";
```

## 3. 基础类型

### KernelAddresses

```ts
type KernelAddresses = {
  gameId?: bigint;
  toolNFT: Address;
  miningCore: Address;
  resourceToken: Address;
  rewardVault?: Address;
  registry?: Address;
};
```

说明：

- `toolNFT`: 工具 NFT 合约地址。
- `gameId`: 当前连接的游戏 ID。通过 `connectGame` 创建客户端时会自动填入。
- `miningCore`: 挖矿核心合约地址。
- `resourceToken`: 资源 Token 合约地址。
- `rewardVault`: 奖励释放控制合约地址。
- `registry`: GameRegistry 合约地址。

### KernelClients

```ts
type KernelClients = {
  publicClient: PublicClient;
  walletClient?: WalletClient;
};
```

说明：

- `publicClient`: 必填，用于读取链上状态和监听事件。
- `walletClient`: 可选，用于发送交易。调用 `buyTool`、`mine`、`mineBatch`、`approveResource`、`upgradeTool` 时必须提供。

### ToolType

```ts
type ToolType = {
  price: bigint;
  maxSupply: bigint;
  minted: bigint;
  power: bigint;
  durability: bigint;
  metadataURI: string;
  exists: boolean;
};
```

### ToolStatus

```ts
type ToolStatus = {
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
```

### RecommendedUpgrade

```ts
type RecommendedUpgrade = {
  fromGameId: bigint;
  toGameId: bigint;
  migrationURI: string;
  hasUpgrade: boolean;
};
```

### ProtocolRelease

```ts
type ProtocolRelease = {
  version: string;
  factory: Address;
  metadataURI: string;
  active: boolean;
  exists: boolean;
};
```

## 4. 创建客户端

### connectGame

通过 `registry + gameId` 自动读取游戏合约地址并创建客户端。

函数签名：

```ts
connectGame(
  registry: Address,
  gameId: bigint,
  clients: KernelClients
): Promise<MiningGameClient>
```

参数：

- `registry`: `GameRegistry` 地址。
- `gameId`: 游戏 ID。
- `clients.publicClient`: viem public client。
- `clients.walletClient`: viem wallet client，可选。

返回：

- `Promise<MiningGameClient>`

示例：

```ts
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { sepolia } from "viem/chains";
import { connectGame } from "@chain-game-nft-core/mining-game-sdk";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("https://your-rpc.example")
});

const walletClient = createWalletClient({
  chain: sepolia,
  transport: custom(window.ethereum)
});

const game = await connectGame("0xRegistry", 1n, {
  publicClient,
  walletClient
});
```

### new MiningGameClient

如果你已经知道所有游戏合约地址，可以直接创建客户端。

函数签名：

```ts
new MiningGameClient(
  addresses: KernelAddresses,
  clients: KernelClients
)
```

示例：

```ts
const game = new MiningGameClient(
  {
    toolNFT: "0xToolNFT",
    miningCore: "0xMiningCore",
    resourceToken: "0xResourceToken",
    rewardVault: "0xRewardVault",
    registry: "0xRegistry"
  },
  {
    publicClient,
    walletClient
  }
);
```

### connectLatestGame

通过 Registry 的推荐升级指针，从初始 gameId 连接到最新推荐 gameId。

函数签名：

```ts
connectLatestGame(
  registry: Address,
  gameId: bigint,
  clients: KernelClients,
  maxHops?: number
): Promise<MiningGameClient>
```

参数：

- `registry`: `GameRegistry` 地址。
- `gameId`: 初始游戏 ID。
- `clients`: viem clients。
- `maxHops`: 最大跳转次数，默认 `8`，避免错误配置造成无限追踪。

返回：

- `Promise<MiningGameClient>`，连接到最新推荐 gameId。

示例：

```ts
import { connectLatestGame } from "@chain-game-nft-core/mining-game-sdk";

const game = await connectLatestGame(registry, 1n, {
  publicClient,
  walletClient
});
```

## 5. 读取类 API

### getGameConfig

返回当前 SDK 客户端保存的合约地址。

函数签名：

```ts
getGameConfig(): Promise<KernelAddresses>
```

参数：无。

返回：

- `KernelAddresses`

示例：

```ts
const config = await game.getGameConfig();
console.log(config.miningCore);
```

### getToolType

读取工具类型配置。

函数签名：

```ts
getToolType(toolType: bigint): Promise<ToolType>
```

参数：

- `toolType`: 工具类型 ID。

返回：

- `price`: 购买价格。
- `maxSupply`: 最大供应量。
- `minted`: 已铸造数量。
- `power`: 初始 power。
- `durability`: 初始耐久。
- `metadataURI`: 元数据 URI。
- `exists`: 是否存在。

示例：

```ts
const type = await game.getToolType(1n);
console.log(type.price);
```

### getToolStatus

读取单个工具 NFT 的完整状态。

函数签名：

```ts
getToolStatus(toolId: bigint): Promise<ToolStatus>
```

参数：

- `toolId`: 工具 NFT ID。

返回：

- `toolType`: 工具类型 ID。
- `owner`: 当前 owner。
- `mintedAt`: 铸造时间。
- `activatedAt`: 激活时间。未激活时为 `0n`。
- `expireAt`: 过期时间。未激活时为 `0n`。
- `power`: 当前 power。
- `durability`: 当前耐久。
- `level`: 当前等级。
- `lastUsedAt`: 上次挖矿时间。
- `active`: 是否有效。
- `canMine`: 当前是否可挖。
- `pendingReward`: 当前预计产出。

示例：

```ts
const status = await game.getToolStatus(1n);

if (status.canMine) {
  console.log("pending reward", status.pendingReward);
}
```

### canMine

判断工具当前是否可挖。

函数签名：

```ts
canMine(toolId: bigint): Promise<boolean>
```

参数：

- `toolId`: 工具 NFT ID。

返回：

- `true`: 当前可挖。
- `false`: 当前不可挖，可能原因包括未激活、过期、冷却中、耐久不足、奖励释放上限不足、暂停。

示例：

```ts
const ok = await game.canMine(1n);
```

### getPendingReward

读取工具当前预计挖矿产出。

函数签名：

```ts
getPendingReward(toolId: bigint): Promise<bigint>
```

参数：

- `toolId`: 工具 NFT ID。

返回：

- `bigint`: 预计资源产出，18 位精度。

示例：

```ts
const reward = await game.getPendingReward(1n);
```

### getResourceBalance

读取玩家资源余额。

函数签名：

```ts
getResourceBalance(account: Address): Promise<bigint>
```

参数：

- `account`: 玩家地址。

返回：

- `bigint`: ResourceToken 余额，18 位精度。

示例：

```ts
const balance = await game.getResourceBalance(player);
```

### getRecommendedUpgrade

读取当前 gameId 是否有推荐升级目标。

函数签名：

```ts
getRecommendedUpgrade(gameId?: bigint): Promise<RecommendedUpgrade>
```

参数：

- `gameId`: 可选。默认使用当前客户端的 `addresses.gameId`。

返回：

- `fromGameId`: 查询的旧 gameId。
- `toGameId`: 推荐升级的新 gameId。没有升级时为 `0n`。
- `migrationURI`: 迁移规则 URI。
- `hasUpgrade`: 是否存在推荐升级。

示例：

```ts
const upgrade = await game.getRecommendedUpgrade();

if (upgrade.hasUpgrade) {
  console.log("upgrade to", upgrade.toGameId);
  console.log("migration", upgrade.migrationURI);
}
```

## 6. 写入类 API

写入类 API 都会返回交易 Hash。调用方需要自行等待交易确认。

```ts
const hash = await game.mine(1n);
await publicClient.waitForTransactionReceipt({ hash });
```

如果创建客户端时没有传入 `walletClient`，写入类 API 会抛出：

```text
A walletClient is required for write operations.
```

### buyTool

购买工具 NFT。

函数签名：

```ts
buyTool(toolType: bigint, value: bigint): Promise<Hash>
```

参数：

- `toolType`: 工具类型 ID。
- `value`: 支付的原生币数量，必须等于该工具类型的 `price`。

返回：

- `Hash`: 交易 Hash。

示例：

```ts
const type = await game.getToolType(1n);
const hash = await game.buyTool(1n, type.price);
await publicClient.waitForTransactionReceipt({ hash });
```

相关事件：

- `ToolMinted`
- `ToolActivated`，仅当 `activateOnMint = true`。

### mine

使用单个工具挖矿。

函数签名：

```ts
mine(toolId: bigint): Promise<Hash>
```

参数：

- `toolId`: 工具 NFT ID。

返回：

- `Hash`: 交易 Hash。

示例：

```ts
if (await game.canMine(1n)) {
  const hash = await game.mine(1n);
  await publicClient.waitForTransactionReceipt({ hash });
}
```

相关事件：

- `ToolActivated`，首次挖矿且工具未激活时触发。
- `Mined`
- `ResourceMinted`
- `RewardReserved`

### mineBatch

批量挖矿。

函数签名：

```ts
mineBatch(toolIds: bigint[]): Promise<Hash>
```

参数：

- `toolIds`: 工具 NFT ID 数组。

返回：

- `Hash`: 交易 Hash。

注意：

- 任意一个工具不可挖时，整笔交易会 revert。
- 前端建议先逐个调用 `canMine` 过滤可挖工具。

示例：

```ts
const toolIds = [1n, 2n, 3n];
const mineable = [];

for (const toolId of toolIds) {
  if (await game.canMine(toolId)) {
    mineable.push(toolId);
  }
}

if (mineable.length > 0) {
  const hash = await game.mineBatch(mineable);
  await publicClient.waitForTransactionReceipt({ hash });
}
```

### approveResource

授权地址消耗玩家 ResourceToken。

函数签名：

```ts
approveResource(spender: Address, amount: bigint): Promise<Hash>
```

参数：

- `spender`: 被授权地址。升级工具时传入 `miningCore`。
- `amount`: 授权额度。

返回：

- `Hash`: 交易 Hash。

示例：

```ts
const config = await game.getGameConfig();
const hash = await game.approveResource(config.miningCore, 5n * 10n ** 18n);
await publicClient.waitForTransactionReceipt({ hash });
```

相关事件：

- `Approval`

### upgradeTool

升级工具。

函数签名：

```ts
upgradeTool(toolId: bigint): Promise<Hash>
```

参数：

- `toolId`: 工具 NFT ID。

返回：

- `Hash`: 交易 Hash。

前置条件：

- 调用者必须是工具 owner。
- 工具必须处于 active 状态。
- 如果 `upgradeCost > 0`，玩家必须先授权 `MiningCore` 消耗足够 ResourceToken。

示例：

```ts
const config = await game.getGameConfig();

const approveHash = await game.approveResource(config.miningCore, 5n * 10n ** 18n);
await publicClient.waitForTransactionReceipt({ hash: approveHash });

const upgradeHash = await game.upgradeTool(1n);
await publicClient.waitForTransactionReceipt({ hash: upgradeHash });
```

相关事件：

- `ResourceBurned`
- `ToolUpgraded`

## 7. 事件监听 API

### watchEvents

监听游戏核心事件。

函数签名：

```ts
watchEvents(handlers: EventHandlers): () => void
```

参数：

```ts
type EventHandlers = Partial<{
  mined: (log: unknown) => void;
  toolMinted: (log: unknown) => void;
  toolActivated: (log: unknown) => void;
  resourceMinted: (log: unknown) => void;
  resourceBurned: (log: unknown) => void;
  toolUpgraded: (log: unknown) => void;
}>;
```

返回：

- `() => void`: 取消监听函数。

示例：

```ts
const unwatch = game.watchEvents({
  mined: (log) => {
    console.log("mined", log);
  },
  toolMinted: (log) => {
    console.log("tool minted", log);
  },
  resourceMinted: (log) => {
    console.log("resource minted", log);
  },
  toolUpgraded: (log) => {
    console.log("tool upgraded", log);
  }
});

unwatch();
```

当前 SDK 已封装事件：

- `Mined`
- `ToolMinted`
- `ToolActivated`
- `ResourceMinted`
- `ResourceBurned`
- `ToolUpgraded`

建议索引器额外直接监听：

- `GameCreated`
- `GameRegistered`
- `RewardReserved`
- `GameStatusUpdated`

## 8. 常见前端流程

### 展示游戏首页

```ts
const game = await connectGame(registry, gameId, { publicClient });
const toolType = await game.getToolType(1n);
```

### 展示最新版游戏首页

```ts
const game = await connectLatestGame(registry, gameId, { publicClient });
const config = await game.getGameConfig();
console.log(config.gameId);
```

### 玩家购买工具

```ts
const game = await connectGame(registry, gameId, { publicClient, walletClient });
const toolType = await game.getToolType(1n);
const hash = await game.buyTool(1n, toolType.price);
await publicClient.waitForTransactionReceipt({ hash });
```

### 玩家挖矿

```ts
const status = await game.getToolStatus(1n);

if (status.canMine) {
  const hash = await game.mine(1n);
  await publicClient.waitForTransactionReceipt({ hash });
}
```

### 玩家升级

```ts
const config = await game.getGameConfig();
const approveHash = await game.approveResource(config.miningCore, 5n * 10n ** 18n);
await publicClient.waitForTransactionReceipt({ hash: approveHash });

const upgradeHash = await game.upgradeTool(1n);
await publicClient.waitForTransactionReceipt({ hash: upgradeHash });
```

## 9. 单位约定

- 地址使用 `0x` EVM 地址。
- 时间使用 Unix timestamp，单位秒。
- Token 金额使用 `bigint`，ResourceToken 为 18 位精度。
- `bps` 表示基点，`10000` 等于 `100%`。
- 交易函数返回 `Hash`，不会自动等待确认。

## 10. 错误处理建议

常见合约错误：

- `NOT_TOOL_OWNER`: 调用者不是工具 owner。
- `CANNOT_MINE`: 当前不可挖，可能是冷却、过期、耐久或奖励上限。
- `PRICE`: 购买工具支付金额不等于价格。
- `SOLD_OUT`: 工具类型已售罄。
- `EMISSION_CAP`: 奖励释放超过限制。
- `ALLOWANCE`: ResourceToken 授权不足。
- `BALANCE`: ResourceToken 余额不足。

前端建议：

- 购买前读取 `getToolType`。
- 挖矿前读取 `getToolStatus` 或 `canMine`。
- 批量挖矿前过滤不可挖工具。
- 升级前检查资源余额并完成授权。
