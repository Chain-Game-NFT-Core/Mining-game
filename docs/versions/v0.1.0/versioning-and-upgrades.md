# 版本控制与无缝升级策略

本文档说明协议内核升级后，已经接入旧版本的游戏项目如何继续可用，并如何迁移到新版本。

## 1. 核心原则

协议升级不应破坏已经上线的游戏实例。

Mining-game 使用以下策略：

- 旧游戏实例不原地修改。
- 新协议版本部署新的 `GameFactory`。
- 多个 Factory 共享同一个长期 `GameRegistry`。
- Registry 记录每个 gameId 的创建 Factory 和协议版本。
- 游戏方创建新版游戏实例后，用 Registry 建立旧 gameId 到新 gameId 的升级推荐。
- 前端和 SDK 可以选择固定连接旧版本，也可以跟随推荐升级到最新 gameId。

这意味着“无缝升级”不是强制把旧合约变成新合约，而是让旧版本继续运行，同时给玩家和前端一个标准化迁移入口。

## 2. 为什么不直接升级旧合约

当前 MVP 合约没有使用代理合约。这样做的好处是：

- 游戏规则更透明。
- 玩家可以审计自己接入的是哪一版合约。
- 旧版本不会被提供方意外改坏。
- 不会因为代理管理员权限引入额外信任风险。

代价是：

- 新功能需要部署新游戏实例。
- 旧资产迁移需要游戏方设计迁移规则。
- 前端需要识别旧 gameId 是否有推荐升级。

## 3. 角色分工

内核提供方：

- 部署新版 `GameFactory`。
- 复用旧 `GameRegistry`。
- 授权新版 Factory 写入 Registry。
- 在 Registry 中登记协议版本发布记录。
- 发布新版 SDK 和版本文档。

游戏项目方：

- 判断是否需要升级到新版协议。
- 使用新版 Factory 创建新版游戏实例。
- 设置旧 gameId 到新 gameId 的升级推荐。
- 设计资产、积分、白名单或权益迁移规则。
- 前端展示迁移提示。

玩家：

- 可以继续使用旧游戏实例。
- 可以按项目方规则迁移到新游戏实例。

## 4. Registry 的版本字段

每条游戏记录包含：

```solidity
struct GameRecord {
    uint256 gameId;
    address operator;
    address factory;
    address toolNFT;
    address miningCore;
    address resourceToken;
    address rewardVault;
    string version;
    VerificationStatus status;
    string riskTag;
    bool exists;
}
```

关键字段：

- `factory`: 创建该游戏实例的 Factory 地址。
- `version`: 该游戏实例使用的协议版本。
- `status`: 认证状态。
- `riskTag`: 风险标签。

## 5. 协议版本发布记录

Registry 支持登记协议版本：

```solidity
setProtocolRelease(
    string version,
    address factory,
    string metadataURI,
    bool active
)
```

建议 `metadataURI` 指向一份 JSON：

```json
{
  "version": "1.1.0",
  "factory": "0x...",
  "registry": "0x...",
  "docs": "ipfs://...",
  "sdk": "@chain-game-nft-core/mining-game-sdk@1.1.0",
  "changelog": [
    "add season module",
    "add batch claim"
  ],
  "compatibility": {
    "from": ["1.0.0"],
    "migrationRequired": true
  }
}
```

## 6. 新 Factory 复用旧 Registry

部署第一版时：

```ts
const factory = await Factory.deploy(registryAdmin, ethers.ZeroAddress);
```

`existingRegistry = address(0)` 表示部署新的 Registry。

部署后保存：

```ts
const registry = await factory.registry();
```

部署后续版本时：

```ts
const nextFactory = await Factory.deploy(registryAdmin, existingRegistry);
```

然后由 `registryAdmin` 授权新版 Factory：

```ts
await registry.setRegistrar(await nextFactory.getAddress(), true);
```

之后新版 Factory 才能向同一个 Registry 注册新游戏。

## 7. 项目方升级流程

假设项目方已经上线：

```text
gameId = 1
version = 1.0.0
```

内核提供方发布：

```text
GameFactory v1.1.0
```

项目方升级步骤：

```text
1. 阅读 v1.1.0 版本文档和变更日志
2. 使用 v1.1.0 Factory 调用 createGame
3. 获得新 gameId，例如 2
4. 校验新游戏参数、地址、事件
5. 调用 Registry.recommendGameUpgrade(1, 2, migrationURI)
6. 前端检测到 gameId 1 有推荐升级
7. 前端展示迁移入口或直接连接推荐最新 gameId
```

推荐升级函数：

```solidity
recommendGameUpgrade(
    uint256 fromGameId,
    uint256 toGameId,
    string migrationURI
)
```

限制：

- 调用者必须是旧游戏 operator。
- 新旧游戏 operator 必须相同。
- 新旧 gameId 不能相同。

## 8. SDK 连接策略

固定连接某个版本：

```ts
const game = await connectGame(registry, 1n, { publicClient, walletClient });
```

这种方式永远连接 `gameId = 1`，适合旧版本后台、审计页面、历史数据页面。

跟随推荐升级：

```ts
import { connectLatestGame } from "@chain-game-nft-core/mining-game-sdk";

const game = await connectLatestGame(registry, 1n, {
  publicClient,
  walletClient
});
```

这种方式会读取 Registry 中的推荐升级链，最终连接到最新推荐 gameId。

查询升级信息：

```ts
const upgrade = await game.getRecommendedUpgrade();

if (upgrade.hasUpgrade) {
  console.log(upgrade.toGameId);
  console.log(upgrade.migrationURI);
}
```

## 9. 资产迁移方式

当前内核不强制定义资产迁移，因为不同游戏经济模型不同。

常见迁移方式：

- 快照旧 `ToolNFT` 持有人，给新版游戏白名单。
- 根据旧工具等级给新版资源或 NFT。
- 允许旧资源按固定比例兑换新版资源。
- 只迁移身份和权益，不迁移资源余额。
- 保持旧版本可玩，新版本作为新赛季。

`migrationURI` 应说明项目方选择的迁移规则。

## 10. 文档版本化

文档应按版本保留快照：

```text
docs/versions/v0.1.0/
docs/versions/v1.0.0/
docs/versions/v1.1.0/
```

每个版本建议包含：

```text
provider-deployment.md
game-operator-deployment.md
sdk-api-reference.md
changelog.md
compatibility.md
```

当前最新版文档保留在：

```text
docs/provider-deployment.md
docs/game-operator-deployment.md
docs/sdk-api-reference.md
```

历史版本只做兼容参考，不随最新版 API 改写。

## 11. 版本号约定

推荐使用语义化版本：

```text
MAJOR.MINOR.PATCH
```

- `PATCH`: 修复文档、SDK 小问题、测试问题，不改变链上接口。
- `MINOR`: 新增兼容功能，旧游戏仍可继续使用。
- `MAJOR`: 合约接口或经济逻辑有破坏性变化，需要游戏方显式迁移。

## 12. 兼容性检查清单

内核提供方发布新版本前：

- 新 Factory 已复用旧 Registry。
- 新 Factory 已获得 Registry registrar 权限。
- `setProtocolRelease` 已登记新版本。
- SDK 能读取旧游戏和新游戏。
- SDK 能读取推荐升级。
- 文档已归档旧版本。
- 变更日志说明是否需要迁移。

游戏方升级前：

- 新游戏参数已复核。
- 新 gameId 已注册。
- 旧 gameId 到新 gameId 的升级推荐已设置。
- `migrationURI` 已发布迁移规则。
- 前端能识别和展示升级状态。
- 玩家可以继续访问旧版本历史数据。
