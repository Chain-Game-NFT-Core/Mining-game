# sol-vue

Vue 前端控制台，用于操作当前仓库里的 Mining Game Kernel。

页面包含三块：

- Provider Deploy：部署 `GameFactory`，并读取 `GameRegistry`。
- Operator Create Game：通过 Factory 创建游戏实例。
- Player Use：通过 `registry + gameId` 连接游戏，购买工具、挖矿、升级和查询余额。

## 依赖

当前 Vite 配置要求 Node.js `20.19+` 或 `22.12+`。如果本机 Node 低于这个版本，`pnpm build` 会失败。

当前项目依赖：

```json
{
  "@chain-game-nft-core/mining-game-sdk": "file:../js",
  "viem": "^2.17.0"
}
```

如果依赖还没有安装，执行：

```sh
pnpm install
```

## 开发

```sh
pnpm dev
```

## 构建

```sh
pnpm build
```

## 使用顺序

1. 连接钱包。
2. 首次部署时在 Provider Deploy 中填写 `Registry admin`，`Existing registry` 留空，点击 `Deploy Factory`。
3. 后续协议版本部署时填写已有 Registry 地址，再部署新 Factory。
4. 在 Operator Create Game 中填写游戏参数，点击 `Create Game`。
5. 在 Player Use 中使用 `registry + gameId` 加载游戏。
6. 游戏创建方可以回到 Operator Create Game，调整工具类型参数后点击 `新增/配置 NFT 工具`。
7. 读取工具类型，购买工具，读取工具状态，执行挖矿或升级。

## 合约 Artifact

Factory 部署使用：

```text
src/contracts/GameFactory.json
```

该文件来自：

```text
../sol-js/artifacts/contracts/GameFactory.sol/GameFactory.json
```

如果合约重新编译并改变 Factory ABI 或 bytecode，需要同步复制新的 artifact。
