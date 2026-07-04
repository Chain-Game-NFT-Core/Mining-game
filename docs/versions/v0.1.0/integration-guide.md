# Mining-game 对接文档入口

Mining-game 的部署和接入分为三个角色视角：

- [游戏内核提供方部署文档](provider-deployment.md)：面向协议/平台方，负责部署 `GameFactory`、维护 `GameRegistry`、发布合约地址和 SDK。
- [游戏内核对接方部署文档](game-operator-deployment.md)：面向游戏项目方，负责通过 Factory 创建自己的游戏实例，并把前端接到 `registry + gameId`。
- [游戏 API 与 SDK 函数参考](sdk-api-reference.md)：面向前端、后台和索引器开发，说明 SDK 函数、参数、返回值、事件和常见调用流程。
- [版本控制与无缝升级策略](versioning-and-upgrades.md)：说明新版本内核发布后，旧游戏如何继续运行、如何推荐迁移到新版 gameId。

推荐阅读顺序：

```text
协议提供方：provider-deployment.md -> sdk-api-reference.md
游戏项目方：game-operator-deployment.md -> sdk-api-reference.md
前端开发：sdk-api-reference.md -> game-operator-deployment.md
```
