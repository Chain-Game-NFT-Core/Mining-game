# Mining-game

全链上资源采集游戏内核协议 MVP。

- `sol-js/`: Solidity 合约工程，包含 `GameFactory`、`GameRegistry`、`ToolNFT`、`MiningCore`、`ResourceToken`、`RewardVault`、`RuleModuleV1` 与 Hardhat 测试。
- `js/`: TypeScript SDK npm 包，基于 `viem` 封装游戏连接、状态读取、挖矿、批量挖矿、升级和事件监听。
- `sol-vue/`: Vue 示例控制台，用于演示协议提供方部署、游戏方创建实例、配置 NFT 工具和玩家操作。

## 游戏内核说明

Mining-game 是一套面向 Web3 游戏项目方的链上挖矿与资源采集内核。它不绑定具体世界观，也不替项目方设计最终经济模型，而是把常见的链上玩法能力抽象成可复用合约模块：

- `GameFactory`: 协议入口。游戏方通过 Factory 创建自己的游戏实例。
- `GameRegistry`: 全局注册表。记录每个游戏实例的 `gameId`、游戏方、Factory、核心合约地址、版本和认证状态。
- `ToolNFT`: 玩家持有的工具 NFT。工具可按类型配置价格、供应量、算力、耐久和元数据。
- `MiningCore`: 挖矿核心。负责校验工具归属、有效期、冷却、耐久和奖励释放规则。
- `ResourceToken`: 游戏内资源 Token。玩家挖矿后获得，可用于升级、消耗、合成或游戏内活动。
- `RewardVault`: 奖励释放金库。控制初始奖励、每日释放上限、赛季释放上限和暂停状态。
- `RuleModuleV1`: 规则模块。定义基础产出、冷却、耐久消耗、等级倍率、算力倍率和升级参数。

每个游戏实例会拥有独立的 `ToolNFT`、`MiningCore`、`ResourceToken`、`RewardVault` 和 `RuleModuleV1`，因此不同项目方之间的资产、规则和奖励池相互隔离。协议提供方可以持续发布新的 Factory 版本，旧游戏实例继续运行，新游戏可以选择接入新版内核。

## 玩法说明

项目方的典型流程：

1. 使用协议提供方部署好的 `GameFactory` 创建游戏实例。
2. 配置工具 NFT 类型，例如普通矿机、高级矿机、限量采集器等。
3. 设置资源名称、资源符号、奖励池、释放周期、冷却时间和升级消耗。
4. 将前端或后台接入 `GameRegistry + gameId`。
5. 后续可为已创建游戏新增或调整未售出的 NFT 工具类型。

玩家的典型流程：

1. 进入游戏前端，读取可购买的工具类型。
2. 支付原生币购买 `ToolNFT`。
3. 工具在购买后立即激活，或在首次挖矿时激活，取决于游戏方配置。
4. 玩家调用挖矿，`MiningCore` 校验工具状态并发放 `ResourceToken`。
5. 工具进入冷却期，并消耗耐久。
6. 玩家可以使用资源升级工具，提升等级、算力或耐久。
7. 工具到期、耐久不足、冷却未结束或奖励池达到上限时，暂时不能继续挖矿。

当前 MVP 更适合做“资源采集 / 工具 NFT / 赛季奖励 / 升级消耗”类玩法原型。协议本身不承诺资源 Token 或 NFT 的金融收益，游戏方应把资源优先设计为游戏内消耗、进度、合成、活动报名或成就凭证。

## 合约

```bash
cd sol-js
npm install
npm test
```

## SDK

```bash
cd js
npm install
npm run build
npm test
```

## 使用demo

```
cd sol-vue
pnpm install
pnpm run dev
```

## 文档

- [文档入口](docs/versions/v0.1.0/integration-guide.md)
- [游戏内核提供方部署文档](docs/versions/v0.1.0/provider-deployment.md)
- [游戏内核对接方部署文档](docs/versions/v0.1.0/game-operator-deployment.md)
- [游戏 API 与 SDK 函数参考](docs/versions/v0.1.0/sdk-api-reference.md)
- [版本控制与无缝升级策略](docs/versions/v0.1.0/versioning-and-upgrades.md)
