# 游戏内核对接方部署文档

本文档面向游戏项目方。项目方不需要自己部署协议入口，只需要使用协议提供方给出的 `GameFactory` 地址创建游戏实例，然后在前端或后台接入 `registry + gameId`。

## 1. 对接前准备

需要准备：

- 协议提供方发布的 `GameFactory` 地址。
- 协议提供方发布的 `GameRegistry` 地址。
- 目标链 RPC 和 Chain ID。
- 游戏方部署钱包 `operator`。
- 工具 NFT 参数。
- 资源 Token 参数。
- 挖矿产出参数。
- 奖励释放参数。
- 升级参数。
- 前端项目或运营后台项目。

当前 MVP：

- 工具资产是 ERC-721 风格 NFT。
- 资源资产是 ERC-20 风格 Token。
- 每个游戏实例会部署独立的 `ToolNFT`、`MiningCore`、`ResourceToken`、`RewardVault` 和 `RuleModuleV1`。

## 2. 参数规划

工具 NFT 参数：

- `toolName`: 工具 NFT 名称。
- `toolSymbol`: 工具 NFT 符号。
- `toolDuration`: 工具有效期，单位秒，默认建议 30 天。
- `activateOnMint`: 是否购买后立即激活。
- `expiredTransferable`: 过期工具是否允许继续转移。

资源 Token 参数：

- `resourceName`: 资源 Token 名称。
- `resourceSymbol`: 资源 Token 符号。

奖励释放参数：

- `initialRewards`: 初始可释放奖励额度。
- `dailyEmissionCap`: 每日全局释放上限。
- `seasonEmissionCap`: 赛季全局释放上限。
- `emissionStart`: 释放开始时间戳。
- `emissionEnd`: 释放结束时间戳。

挖矿规则参数：

- `baseReward`: 基础产出。
- `cooldown`: 单个工具挖矿冷却时间，单位秒。
- `durabilityCost`: 每次挖矿消耗耐久。
- `levelMultiplierBps`: 每升一级增加的收益基点。
- `powerMultiplierBps`: 每点 power 增加的收益基点。

升级参数：

- `upgradeCost`: 升级消耗的资源数量。
- `upgradePowerIncrease`: 每次升级增加的 power。
- `upgradeDurabilityIncrease`: 每次升级增加的 durability。

工具类型参数：

- `toolType`: 工具类型 ID，从 `1` 开始更直观。
- `price`: 购买价格，使用原生币。
- `maxSupply`: 最大供应量。
- `power`: 初始算力。
- `durability`: 初始耐久。
- `metadataURI`: NFT 元数据 URI。

## 3. 奖励公式

当前 `RuleModuleV1` 奖励公式：

```text
reward = baseReward
  * (10000 + power * powerMultiplierBps)
  * (10000 + (level - 1) * levelMultiplierBps)
  / 100000000
```

示例：

```text
baseReward = 10 ORE
power = 10
powerMultiplierBps = 1000
level = 1
levelMultiplierBps = 1000

reward = 10 * (10000 + 10 * 1000) * 10000 / 100000000
reward = 20 ORE
```

## 4. 创建游戏实例

使用协议提供方给出的 `GameFactory` 地址调用 `createGame(config, toolTypes)`。

示例脚本：

```ts
import { ethers } from "hardhat";

const DAY = 24 * 60 * 60;

async function main() {
  const factoryAddress = "0xFactoryFromProvider";
  const [operator] = await ethers.getSigners();
  const factory = await ethers.getContractAt("GameFactory", factoryAddress);
  const now = Math.floor(Date.now() / 1000);

  const config = {
    toolName: "Mining Tool",
    toolSymbol: "MTL",
    resourceName: "Ore",
    resourceSymbol: "ORE",
    toolDuration: 30 * DAY,
    activateOnMint: false,
    expiredTransferable: false,
    initialRewards: ethers.parseEther("100000"),
    dailyEmissionCap: ethers.parseEther("1000"),
    seasonEmissionCap: ethers.parseEther("10000"),
    emissionStart: now,
    emissionEnd: now + 60 * DAY,
    baseReward: ethers.parseEther("10"),
    cooldown: 3600,
    durabilityCost: 1,
    levelMultiplierBps: 1000,
    powerMultiplierBps: 1000,
    upgradeCost: ethers.parseEther("5"),
    upgradePowerIncrease: 2,
    upgradeDurabilityIncrease: 3
  };

  const toolTypes = [
    {
      toolType: 1,
      price: ethers.parseEther("0.1"),
      maxSupply: 1000,
      power: 10,
      durability: 100,
      metadataURI: "ipfs://tool-type-1"
    }
  ];

  const predicted = await factory.connect(operator).createGame.staticCall(config, toolTypes);
  const tx = await factory.connect(operator).createGame(config, toolTypes);
  const receipt = await tx.wait();

  console.log("gameId:", predicted.gameId.toString());
  console.log("toolNFT:", predicted.toolNFT);
  console.log("miningCore:", predicted.miningCore);
  console.log("resourceToken:", predicted.resourceToken);
  console.log("rewardVault:", predicted.rewardVault);
  console.log("ruleModule:", predicted.ruleModule);
  console.log("tx:", receipt?.hash);
}

main();
```

## 5. 创建后保存的信息

必须保存：

- `gameId`
- `GameRegistry` 地址
- `GameFactory` 地址
- `ToolNFT` 地址
- `MiningCore` 地址
- `ResourceToken` 地址
- `RewardVault` 地址
- `RuleModuleV1` 地址
- 部署交易 Hash
- 游戏方 operator 地址

前端推荐只写入：

```text
registry + gameId
```

其他地址由 SDK 从 Registry 读取，减少配置错误。

## 6. 创建后权限

游戏方 `operator` 会成为以下合约 owner：

- `ToolNFT`
- `MiningCore`
- `ResourceToken`
- `RewardVault`

建议上线前把 owner 转给多签或 Timelock。

## 7. 运营后台可调用函数

`MiningCore`：

- `setPaused(bool value)`: 暂停或恢复挖矿。
- `setRuleModule(address rules)`: 更换规则模块。
- `setUpgradeConfig(uint256 cost, uint256 powerIncrease, uint256 durabilityIncrease)`: 修改升级参数。

`RewardVault`：

- `setPaused(bool value)`: 暂停或恢复奖励释放。
- `setDailyEmissionCap(uint256 value)`: 修改每日释放上限。
- `setSeasonEmissionCap(uint256 value)`: 修改赛季释放上限。
- `fund(uint256 amount)`: 增加可释放额度。这里是记账额度，不是 ERC-20 转账。

`ToolNFT`：

- `configureToolType(...)`: 配置工具类型。已经铸造过的工具类型不能修改 `maxSupply`。
- `withdraw(address payable to)`: 提取玩家购买工具支付的原生币。
- `setMiningCore(address core)`: 修改 MiningCore 地址。

`ResourceToken`：

- `setMinter(address newMinter)`: 修改资源铸造地址。

## 8. 前端接入步骤

前端接入推荐顺序：

```text
安装 SDK
创建 publicClient
创建 walletClient
connectGame(registry, gameId, clients)
读取工具类型 getToolType
购买工具 buyTool
读取工具状态 getToolStatus
判断 canMine
调用 mine 或 mineBatch
读取资源余额 getResourceBalance
授权 approveResource
升级 upgradeTool
监听事件 watchEvents
```

详细函数参数见 [游戏 API 与 SDK 函数参考](sdk-api-reference.md)。

如果内核提供方发布了新版本，项目方可以创建新的 gameId 并在 Registry 里设置升级推荐。完整策略见 [版本控制与无缝升级策略](versioning-and-upgrades.md)。

项目方推荐升级旧游戏：

```ts
const registry = await ethers.getContractAt("GameRegistry", registryAddress);
await registry.connect(operator).recommendGameUpgrade(
  oldGameId,
  newGameId,
  "ipfs://migration-rules"
);
```

## 9. 玩家最小流程

```text
连接钱包
读取工具类型
购买 ToolNFT
读取工具状态
调用 mine(toolId)
获得 ResourceToken
授权 MiningCore 消耗资源
调用 upgradeTool(toolId)
继续挖矿
工具到期后停止挖矿
```

## 10. 上线检查清单

合约侧：

- `gameId` 和 Registry 记录可读取。
- `GameCreated` 事件地址和保存地址一致。
- `operator` 是正确地址。
- owner 已转给多签或 Timelock。
- `dailyEmissionCap`、`seasonEmissionCap` 符合经济上限。
- `toolDuration`、`maxSupply`、`cooldown` 符合游戏规则。

前端侧：

- 能通过 `registry + gameId` 连接游戏。
- 能展示工具类型价格、供应量、power、durability。
- 能购买工具。
- 能读取工具状态。
- 能判断 `canMine`。
- 能挖矿并刷新资源余额。
- 能完成授权和升级。
- 能监听核心事件并更新 UI。

运营侧：

- 购买收入提取地址已确认。
- 暂停开关已测试。
- 参数变更权限已确认。
- 风险提示、收益边界和游戏规则已展示清楚。
