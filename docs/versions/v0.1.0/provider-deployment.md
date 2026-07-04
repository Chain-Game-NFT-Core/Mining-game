# 游戏内核提供方部署文档

本文档面向协议提供方或平台方。提供方负责部署协议入口、维护 Registry 认证状态、发布 SDK 和合约地址。游戏项目方后续通过已部署的 `GameFactory` 创建自己的游戏实例。

## 1. 职责边界

游戏内核提供方负责：

- 部署 `GameFactory`。
- 保存并公开 `GameFactory` 地址。
- 保存并公开 `GameRegistry` 地址。
- 管理 Registry 认证状态和风险标签。
- 发布 TypeScript SDK。
- 发布 ABI、合约版本、网络信息和部署记录。
- 给游戏方提供参数建议和安全提示。

游戏内核提供方不负责：

- 替游戏方设计经济模型。
- 托管玩家资产。
- 承诺资源 Token 或 NFT 收益。
- 直接修改游戏方已部署实例的 owner 参数。

## 2. 部署前准备

需要准备：

- 目标 EVM 链 RPC。
- 部署钱包 `deployer`。
- Registry 管理地址 `registryAdmin`，建议使用多签。
- 区块浏览器 API Key，用于后续合约验证。
- 发布版本号，例如 `0.1.0`。

本仓库合约入口：

```text
sol-js/contracts/GameFactory.sol
```

Factory 构造参数：

```solidity
constructor(address initialRegistryAdmin, address existingRegistry)
```

- `initialRegistryAdmin`: Registry 管理地址，建议使用多签。
- `existingRegistry`: 已存在 Registry 地址。首次部署传 `address(0)`，后续版本传旧 Registry 地址。

## 3. 本地验证

```bash
cd sol-js
npm install
npm test
```

测试通过后再部署到测试网或主网。

## 4. 配置网络

当前 `sol-js/hardhat.config.ts` 只包含本地默认配置。部署到测试网或主网前，需要按自己的网络补充配置，例如：

```ts
networks: {
  sepolia: {
    url: process.env.SEPOLIA_RPC_URL!,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY!]
  }
}
```

同时建议使用 `.env` 管理私钥和 RPC。不要把私钥提交到仓库。

## 5. 部署 GameFactory

可以新建部署脚本，也可以在 Hardhat Console 中执行。核心逻辑如下：

```ts
import { ethers } from "hardhat";

async function main() {
  const registryAdmin = "0xYourRegistryAdmin";
  const Factory = await ethers.getContractFactory("GameFactory");
  const factory = await Factory.deploy(registryAdmin, ethers.ZeroAddress);
  await factory.waitForDeployment();

  console.log("GameFactory:", await factory.getAddress());
  console.log("GameRegistry:", await factory.registry());
  console.log("RegistryAdmin:", await factory.registryAdmin());
}

main();
```

`ethers.ZeroAddress` 表示首次部署时创建新的 `GameRegistry`。

部署后必须记录：

- 网络名称和 Chain ID。
- `GameFactory` 地址。
- `GameRegistry` 地址。
- `registryAdmin` 地址。
- 部署交易 Hash。
- 合约版本，也就是 `GameFactory.VERSION()`。

## 6. Registry 管理

每个游戏方调用 `createGame(...)` 后，Factory 会自动把游戏实例写入 Registry。

提供方可以用 `registryAdmin` 调整认证状态：

```solidity
setGameStatus(uint256 gameId, VerificationStatus status, string riskTag)
```

状态枚举：

```text
0 Permissionless
1 Verified
2 Audited
3 Featured
4 Deprecated
```

建议使用方式：

- `Permissionless`: 默认状态，任何游戏方创建后即为此状态。
- `Verified`: 参数、地址、前端入口已做基础核验。
- `Audited`: 游戏实例或自定义模块已完成审计。
- `Featured`: 平台推荐项目。
- `Deprecated`: 存在迁移、停服、严重风险或不再推荐。

`riskTag` 可以写简短风险标记，例如：

```text
custom-rule-module
high-emission
owner-eoa
deprecated-version
```

Registry 还负责管理可写入游戏记录的 Factory：

```solidity
setRegistrar(address registrar, bool authorized)
```

首次部署的 Factory 会自动获得 registrar 权限。部署后续版本 Factory 时，需要由 `registryAdmin` 手动授权新版 Factory。

## 7. 发布给游戏方的信息

每条链至少发布：

```json
{
  "chainId": 11155111,
  "network": "sepolia",
  "version": "0.1.0",
  "gameFactory": "0x...",
  "gameRegistry": "0x...",
  "registryAdmin": "0x..."
}
```

同时发布：

- `GameFactory` ABI。
- `GameRegistry` ABI。
- SDK 包名和版本。
- 推荐参数范围。
- 风险提示文本。

## 8. SDK 发布流程

SDK 工程在 `js/`：

```bash
cd js
npm install
npm run build
npm test
```

发布前确认：

- `package.json` 的 `name`、`version` 正确。
- `dist/` 已生成。
- `peerDependencies.viem` 版本范围合理。
- API 文档已更新。

发布到 npm：

```bash
npm publish --access public
```

如果只是内部使用，可以发布到私有 npm registry 或通过 monorepo workspace 引入。

## 9. 升级和多版本策略

当前 `GameFactory.VERSION()` 固定为 `0.1.0`。后续升级建议：

- 新版本部署新的 `GameFactory`。
- 旧 Registry 保留历史游戏记录。
- 后续版本 Factory 复用旧 Registry。
- `registryAdmin` 调用 `setRegistrar(newFactory, true)` 授权新 Factory。
- `registryAdmin` 调用 `setProtocolRelease(version, factory, metadataURI, active)` 登记协议发布记录。
- 不建议直接替换旧 Factory 地址。
- 游戏方创建新版 gameId 后，通过 `recommendGameUpgrade(oldGameId, newGameId, migrationURI)` 建立迁移推荐。
- 前端可以固定连接旧 gameId，也可以用 SDK 的 `connectLatestGame` 跟随推荐升级。

完整策略见 [版本控制与无缝升级策略](versioning-and-upgrades.md)。

## 10. 提供方上线检查清单

- `sol-js` 测试通过。
- `js` 构建和测试通过。
- Factory 地址已验证。
- Registry 地址已验证。
- `registryAdmin` 是多签或受控地址。
- 合约源码已在区块浏览器验证。
- ABI、SDK、网络配置已发布。
- 游戏方部署文档已发布。
- API 函数参考已发布。
- 版本控制与升级文档已发布。
- 风险提示和免责声明已发布。
