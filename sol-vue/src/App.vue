<script setup lang="ts">
import { computed, ref } from "vue";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
  isAddress,
  parseEther,
  zeroAddress,
  type Address,
  type Chain,
  type Hash,
  type PublicClient,
  type WalletClient
} from "viem";
import { holesky, mainnet, sepolia } from "viem/chains";
import {
  connectGame,
  type GameRecord,
  type MiningGameClient,
  type ToolStatus,
  type ToolType
} from "@chain-game-nft-core/mining-game-sdk";
import { gameFactoryAbi, gameFactoryBytecode } from "./contracts/gameFactory";
import { gameRegistryAbi, toolNftAbi } from "./contracts/kernelAbis";

type NullableAddress = Address | "";

type CreateGameResult = {
  gameId: bigint;
  toolNFT: Address;
  miningCore: Address;
  resourceToken: Address;
  rewardVault: Address;
  ruleModule: Address;
};

type ProviderDeployment = {
  factory: Address;
  registry: Address;
  registryAdmin: Address;
  version: string;
};

type ToolTypeWithId = ToolType & {
  toolType: bigint;
};

const rpcUrl = ref("");
const account = ref<NullableAddress>("");
const currentChainId = ref<number | null>(null);
const selectedChainId = ref("11155111");
const publicClient = ref<PublicClient | null>(null);
const walletClient = ref<WalletClient | null>(null);
const busy = ref(false);
const status = ref("就绪");
const txHash = ref<Hash | "">("");

const factoryAddress = ref<NullableAddress>("");
const registryAddress = ref<NullableAddress>("");
const registryAdmin = ref<NullableAddress>("");
const existingRegistry = ref<NullableAddress>(zeroAddress);
const providerDeployment = ref<ProviderDeployment | null>(null);
const deployedGames = ref<GameRecord[]>([]);

const createFactoryAddress = ref<NullableAddress>("");
const createdGame = ref<CreateGameResult | null>(null);
const operatorQueryAddress = ref<NullableAddress>("");
const operatorGames = ref<GameRecord[]>([]);
const toolTypeScanLimit = ref("20");
const selectedOperatorGame = ref<GameRecord | null>(null);
const createdToolTypes = ref<ToolTypeWithId[]>([]);
const toolTypeDialogOpen = ref(false);
const toolTypeDialogGame = ref<GameRecord | null>(null);

const gameId = ref("1");
const gameClient = ref<MiningGameClient | null>(null);
const gameAddresses = ref<Record<string, string>>({});
const selectedToolType = ref("1");
const selectedToolId = ref("1");
const playerAddress = ref<NullableAddress>("");
const toolTypeInfo = ref<ToolType | null>(null);
const toolStatus = ref<ToolStatus | null>(null);
const resourceBalance = ref<bigint | null>(null);

const gameConfig = ref({
  toolName: "Mining Tool",
  toolSymbol: "MTL",
  resourceName: "Ore",
  resourceSymbol: "ORE",
  toolDurationDays: "30",
  activateOnMint: false,
  expiredTransferable: false,
  initialRewards: "100000",
  dailyEmissionCap: "1000",
  seasonEmissionCap: "10000",
  emissionDays: "60",
  baseReward: "10",
  cooldownSeconds: "3600",
  durabilityCost: "1",
  levelMultiplierBps: "1000",
  powerMultiplierBps: "1000",
  upgradeCost: "5",
  upgradePowerIncrease: "2",
  upgradeDurabilityIncrease: "3"
});

const toolTypeConfig = ref({
  toolType: "1",
  price: "0.1",
  maxSupply: "1000",
  power: "10",
  durability: "100",
  metadataURI: "ipfs://tool-type-1"
});

const ethereumChains = [
  { label: "Sepolia 测试网", chain: sepolia },
  { label: "Ethereum 主网", chain: mainnet },
  { label: "Holesky 测试网", chain: holesky }
] as const;

const selectedChain = computed(() => {
  return ethereumChains.find(({ chain }) => String(chain.id) === selectedChainId.value)?.chain ?? sepolia;
});

const shortAccount = computed(() => account.value ? `${account.value.slice(0, 6)}...${account.value.slice(-4)}` : "未连接");
const canUseWallet = computed(() => Boolean(publicClient.value && walletClient.value && account.value));

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("未检测到浏览器钱包。");
  }

  const targetChain = selectedChain.value;
  await switchWalletToChain(targetChain);

  const [address] = await window.ethereum.request({ method: "eth_requestAccounts" }) as Address[];
  const chainIdHex = await window.ethereum.request({ method: "eth_chainId" }) as string;
  const chainId = Number.parseInt(chainIdHex, 16);
  if (chainId !== targetChain.id) {
    throw new Error(`当前钱包链 ID 为 ${chainId}，请切换到 ${targetChain.name}。`);
  }
  account.value = address;
  currentChainId.value = chainId;
  registryAdmin.value ||= address;
  playerAddress.value ||= address;
  operatorQueryAddress.value ||= address;

  const transport = rpcUrl.value.trim() ? http(rpcUrl.value.trim()) : custom(window.ethereum);
  publicClient.value = createPublicClient({ chain: targetChain, transport }) as PublicClient;
  walletClient.value = createWalletClient({
    account: address,
    chain: targetChain,
    transport: custom(window.ethereum)
  }) as WalletClient;
  status.value = `钱包已连接，当前以太坊链：${targetChain.name}（${chainId}）`;
}

async function switchWalletToChain(chain: Chain) {
  if (!window.ethereum) {
    throw new Error("未检测到浏览器钱包。");
  }

  const chainId = `0x${chain.id.toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }]
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? Number((error as { code: number }).code)
      : undefined;
    if (code !== 4902) {
      throw error;
    }

    const rpc = rpcUrl.value.trim() || chain.rpcUrls.default.http[0];
    if (!rpc) {
      throw new Error(`钱包未添加 ${chain.name}，请填写 RPC 地址后重试。`);
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [rpc],
          blockExplorerUrls: chain.blockExplorers?.default ? [chain.blockExplorers.default.url] : undefined
        }
      ]
    });
  }
}

async function deployFactory() {
  await runTask("正在部署 GameFactory", async () => {
    const clients = requireClients();
    const admin = requireAddress(registryAdmin.value, "注册表管理员");
    const registry = existingRegistry.value && existingRegistry.value !== zeroAddress
      ? requireAddress(existingRegistry.value, "已有注册表")
      : zeroAddress;

    const hash = await clients.wallet.deployContract({
      abi: gameFactoryAbi,
      bytecode: gameFactoryBytecode,
      args: [admin, registry],
      account: requireAddress(account.value, "wallet")
    });
    txHash.value = hash;

    const receipt = await clients.public.waitForTransactionReceipt({ hash });
    const deployed = receipt.contractAddress;
    if (!deployed) {
      throw new Error("Factory 部署交易没有返回合约地址。");
    }

    factoryAddress.value = deployed;
    createFactoryAddress.value = deployed;
    registryAddress.value = await clients.public.readContract({
      address: deployed,
      abi: gameFactoryAbi,
      functionName: "registry"
    }) as Address;
  });
}

async function loadFactoryDeployments() {
  await runTask("正在读取 Factory 部署信息", async () => {
    const clients = requireClients();
    const targetFactory = requireAddress(factoryAddress.value, "Factory");
    const [registry, admin, version] = await Promise.all([
      clients.public.readContract({
        address: targetFactory,
        abi: gameFactoryAbi,
        functionName: "registry"
      }) as Promise<Address>,
      clients.public.readContract({
        address: targetFactory,
        abi: gameFactoryAbi,
        functionName: "registryAdmin"
      }) as Promise<Address>,
      clients.public.readContract({
        address: targetFactory,
        abi: gameFactoryAbi,
        functionName: "VERSION"
      }) as Promise<string>
    ]);

    registryAddress.value = registry;
    registryAdmin.value = admin;
    providerDeployment.value = {
      factory: targetFactory,
      registry,
      registryAdmin: admin,
      version
    };

    const nextGameId = await clients.public.readContract({
      address: registry,
      abi: gameRegistryAbi,
      functionName: "nextGameId"
    }) as bigint;

    const games: GameRecord[] = [];
    for (let id = 1n; id < nextGameId; id++) {
      const game = normalizeGameRecord(await clients.public.readContract({
        address: registry,
        abi: gameRegistryAbi,
        functionName: "getGame",
        args: [id]
      }));

      if (game.factory.toLowerCase() === targetFactory.toLowerCase()) {
        games.push(game);
      }
    }

    deployedGames.value = games;
  });
}

async function createGame() {
  await runTask("正在创建游戏", async () => {
    const clients = requireClients();
    const targetFactory = requireAddress(createFactoryAddress.value || factoryAddress.value, "Factory");
    const now = BigInt(Math.floor(Date.now() / 1000));
    const day = 24n * 60n * 60n;

    const config = {
      toolName: gameConfig.value.toolName,
      toolSymbol: gameConfig.value.toolSymbol,
      resourceName: gameConfig.value.resourceName,
      resourceSymbol: gameConfig.value.resourceSymbol,
      toolDuration: BigInt(Number(gameConfig.value.toolDurationDays)) * day,
      activateOnMint: gameConfig.value.activateOnMint,
      expiredTransferable: gameConfig.value.expiredTransferable,
      initialRewards: parseEther(gameConfig.value.initialRewards),
      dailyEmissionCap: parseEther(gameConfig.value.dailyEmissionCap),
      seasonEmissionCap: parseEther(gameConfig.value.seasonEmissionCap),
      emissionStart: now,
      emissionEnd: now + BigInt(Number(gameConfig.value.emissionDays)) * day,
      baseReward: parseEther(gameConfig.value.baseReward),
      cooldown: BigInt(gameConfig.value.cooldownSeconds),
      durabilityCost: BigInt(gameConfig.value.durabilityCost),
      levelMultiplierBps: BigInt(gameConfig.value.levelMultiplierBps),
      powerMultiplierBps: BigInt(gameConfig.value.powerMultiplierBps),
      upgradeCost: parseEther(gameConfig.value.upgradeCost),
      upgradePowerIncrease: BigInt(gameConfig.value.upgradePowerIncrease),
      upgradeDurabilityIncrease: BigInt(gameConfig.value.upgradeDurabilityIncrease)
    };

    const toolTypes = [
      {
        toolType: requireUint(toolTypeConfig.value.toolType, "工具类型"),
        price: requireEtherAmount(toolTypeConfig.value.price, "价格"),
        maxSupply: requireUint(toolTypeConfig.value.maxSupply, "最大供应量"),
        power: requireUint(toolTypeConfig.value.power, "算力"),
        durability: requireUint(toolTypeConfig.value.durability, "耐久"),
        metadataURI: toolTypeConfig.value.metadataURI
      }
    ];

    const simulation = await clients.public.simulateContract({
      address: targetFactory,
      abi: gameFactoryAbi,
      functionName: "createGame",
      args: [config, toolTypes],
      account: requireAddress(account.value, "wallet")
    });
    const result = normalizeCreateGameResult(simulation.result);
    const hash = await clients.wallet.writeContract(simulation.request);
    txHash.value = hash;
    await clients.public.waitForTransactionReceipt({ hash });

    createdGame.value = result;
    registryAddress.value ||= await clients.public.readContract({
      address: targetFactory,
      abi: gameFactoryAbi,
      functionName: "registry"
    }) as Address;
    gameId.value = result.gameId.toString();
  });
}

async function configureToolType() {
  await runTask("正在新增或配置 NFT 工具", async () => {
    const clients = requireClients();
    const game = toolTypeDialogGame.value;
    if (!game) {
      throw new Error("请先从已创建游戏中选择要配置的游戏。");
    }

    const args = [
      requireUint(toolTypeConfig.value.toolType, "工具类型"),
      requireEtherAmount(toolTypeConfig.value.price, "价格"),
      requireUint(toolTypeConfig.value.maxSupply, "最大供应量"),
      requireUint(toolTypeConfig.value.power, "算力"),
      requireUint(toolTypeConfig.value.durability, "耐久"),
      toolTypeConfig.value.metadataURI
    ] as const;

    const simulation = await clients.public.simulateContract({
      address: game.toolNFT,
      abi: toolNftAbi,
      functionName: "configureToolType",
      args,
      account: requireAddress(account.value, "wallet")
    });

    const hash = await clients.wallet.writeContract(simulation.request);
    txHash.value = hash;
    await clients.public.waitForTransactionReceipt({ hash });
    selectedToolType.value = toolTypeConfig.value.toolType;
    selectedOperatorGame.value = game;
    createdToolTypes.value = await readCreatedToolTypes(game);
    if (gameClient.value) {
      await refreshToolType();
    }
  });
}

async function loadOperatorGames() {
  await runTask("正在查询游戏方已创建的游戏", async () => {
    const clients = requireClients();
    const registry = requireAddress(registryAddress.value, "registry");
    const operator = requireAddress(operatorQueryAddress.value || account.value, "游戏方");
    const nextGameId = await clients.public.readContract({
      address: registry,
      abi: gameRegistryAbi,
      functionName: "nextGameId"
    }) as bigint;

    const games: GameRecord[] = [];
    for (let id = 1n; id < nextGameId; id++) {
      const game = normalizeGameRecord(await clients.public.readContract({
        address: registry,
        abi: gameRegistryAbi,
        functionName: "getGame",
        args: [id]
      }));

      if (game.operator.toLowerCase() === operator.toLowerCase()) {
        games.push(game);
      }
    }

    operatorGames.value = games;
    if (games[0]) {
      gameId.value = games[0].gameId.toString();
    }
  });
}

async function loadCreatedToolTypes(game: GameRecord) {
  await runTask("正在查询已创建的 NFT 工具类型", async () => {
    selectedOperatorGame.value = game;
    createdToolTypes.value = await readCreatedToolTypes(game);
  });
}

async function readCreatedToolTypes(game: GameRecord) {
  const clients = requireClients();
  const limit = Number.parseInt(toolTypeScanLimit.value, 10);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("工具类型扫描上限必须是正整数。");
  }

  const items: ToolTypeWithId[] = [];
  for (let id = 1; id <= limit; id++) {
    const [price, maxSupply, minted, power, durability, metadataURI, exists] = await clients.public.readContract({
      address: game.toolNFT,
      abi: toolNftAbi,
      functionName: "toolTypes",
      args: [BigInt(id)]
    }) as readonly [bigint, bigint, bigint, bigint, bigint, string, boolean];

    if (exists) {
      items.push({
        toolType: BigInt(id),
        price,
        maxSupply,
        minted,
        power,
        durability,
        metadataURI,
        exists
      });
    }
  }

  return items;
}

function openToolTypeDialog(game: GameRecord) {
  selectedOperatorGame.value = game;
  toolTypeDialogGame.value = game;
  toolTypeDialogOpen.value = true;
  status.value = `正在为游戏 ${game.gameId.toString()} 配置 NFT 工具`;
}

function closeToolTypeDialog() {
  toolTypeDialogOpen.value = false;
  toolTypeDialogGame.value = null;
}

async function loadGame() {
  await runTask("正在加载游戏", async () => {
    const clients = requireClients();
    const registry = requireAddress(registryAddress.value, "registry");
    const client = await connectGame(registry, BigInt(gameId.value), {
      publicClient: clients.public,
      walletClient: clients.wallet
    });

    gameClient.value = client;
    gameAddresses.value = Object.fromEntries(
      Object.entries(await client.getGameConfig()).map(([key, value]) => [key, String(value)])
    );
    await refreshToolType();
    await refreshBalance();
  });
}

async function refreshToolType() {
  const client = requireGameClient();
  toolTypeInfo.value = await client.getToolType(BigInt(selectedToolType.value));
}

async function buyTool() {
  await runTask("正在购买工具", async () => {
    const client = requireGameClient();
    const type = toolTypeInfo.value ?? await client.getToolType(BigInt(selectedToolType.value));
    const hash = await client.buyTool(BigInt(selectedToolType.value), type.price);
    txHash.value = hash;
    await requireClients().public.waitForTransactionReceipt({ hash });
    await refreshBalance();
  });
}

async function refreshToolStatus() {
  const client = requireGameClient();
  toolStatus.value = await client.getToolStatus(BigInt(selectedToolId.value));
}

async function mineTool() {
  await runTask("正在挖矿", async () => {
    const client = requireGameClient();
    const hash = await client.mine(BigInt(selectedToolId.value));
    txHash.value = hash;
    await requireClients().public.waitForTransactionReceipt({ hash });
    await refreshToolStatus();
    await refreshBalance();
  });
}

async function approveAndUpgrade() {
  await runTask("正在升级工具", async () => {
    const client = requireGameClient();
    const addresses = await client.getGameConfig();
    const approveHash = await client.approveResource(addresses.miningCore, parseEther(gameConfig.value.upgradeCost));
    txHash.value = approveHash;
    await requireClients().public.waitForTransactionReceipt({ hash: approveHash });

    const upgradeHash = await client.upgradeTool(BigInt(selectedToolId.value));
    txHash.value = upgradeHash;
    await requireClients().public.waitForTransactionReceipt({ hash: upgradeHash });
    await refreshToolStatus();
    await refreshBalance();
  });
}

async function refreshBalance() {
  if (!playerAddress.value || !isAddress(playerAddress.value) || !gameClient.value) {
    return;
  }
  resourceBalance.value = await gameClient.value.getResourceBalance(playerAddress.value);
}

async function runTask(label: string, task: () => Promise<void>) {
  busy.value = true;
  status.value = label;
  try {
    await task();
    status.value = "完成";
  } catch (error) {
    status.value = error instanceof Error ? error.message : String(error);
  } finally {
    busy.value = false;
  }
}

function requireClients() {
  if (!publicClient.value || !walletClient.value) {
    throw new Error("请先连接钱包。");
  }
  return {
    public: publicClient.value,
    wallet: walletClient.value
  };
}

function requireGameClient() {
  if (!gameClient.value) {
    throw new Error("请先加载游戏。");
  }
  return gameClient.value;
}

function requireAddress(value: string, label: string): Address {
  if (!isAddress(value)) {
    throw new Error(`${label} 地址无效。`);
  }
  return value;
}

function requireUint(value: string, label: string): bigint {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} 必须是非负整数，当前值：${value || "空"}`);
  }
  return BigInt(normalized);
}

function requireEtherAmount(value: string, label: string): bigint {
  try {
    return parseEther(value.trim());
  } catch {
    throw new Error(`${label} 必须是有效 ETH 数量，当前值：${value || "空"}`);
  }
}

function normalizeCreateGameResult(value: unknown): CreateGameResult {
  if (Array.isArray(value)) {
    const result = value as readonly [bigint, Address, Address, Address, Address, Address];
    return {
      gameId: result[0],
      toolNFT: result[1],
      miningCore: result[2],
      resourceToken: result[3],
      rewardVault: result[4],
      ruleModule: result[5]
    };
  }
  return value as CreateGameResult;
}

function normalizeGameRecord(value: unknown): GameRecord {
  if (Array.isArray(value)) {
    const record = value as readonly [
      bigint,
      Address,
      Address,
      Address,
      Address,
      Address,
      Address,
      string,
      number,
      string,
      boolean
    ];
    return {
      gameId: record[0],
      operator: record[1],
      factory: record[2],
      toolNFT: record[3],
      miningCore: record[4],
      resourceToken: record[5],
      rewardVault: record[6],
      version: record[7],
      status: record[8],
      riskTag: record[9],
      exists: record[10]
    };
  }

  return value as GameRecord;
}
</script>

<template>
  <main class="app-shell">
    <section class="topbar">
      <div>
        <p class="eyebrow">链上挖矿游戏内核</p>
        <h1>协议控制台</h1>
      </div>
      <div class="wallet-panel">
        <select v-model="selectedChainId" :disabled="busy">
          <option v-for="item in ethereumChains" :key="item.chain.id" :value="String(item.chain.id)">
            {{ item.label }}
          </option>
        </select>
        <input v-model="rpcUrl" placeholder="所选以太坊链 RPC，可选" />
        <button :disabled="busy" @click="connectWallet">{{ shortAccount }}</button>
      </div>
    </section>

    <section class="status-line">
      <span>{{ status }}</span>
      <span v-if="currentChainId">当前链：{{ currentChainId }}</span>
      <span>目标链：{{ selectedChain.name }}</span>
      <a v-if="txHash" :href="`#${txHash}`">{{ txHash }}</a>
    </section>

    <div class="workspace">
      <section class="panel">
        <div class="panel-title">
          <span>01</span>
          <h2>提供方部署</h2>
        </div>
        <label>
          注册表管理员
          <input v-model="registryAdmin" placeholder="0x..." />
        </label>
        <label>
          Factory 地址
          <input v-model="factoryAddress" placeholder="输入已部署 Factory 或部署后自动填充" />
        </label>
        <label>
          已有注册表
          <input v-model="existingRegistry" placeholder="首次部署默认零地址" />
        </label>
        <div class="button-row">
          <button :disabled="!canUseWallet || busy" @click="deployFactory">部署 Factory</button>
          <button :disabled="!canUseWallet || busy || !factoryAddress" @click="loadFactoryDeployments">读取已部署信息</button>
        </div>
        <dl>
          <div>
            <dt>Factory</dt>
            <dd>{{ factoryAddress || "-" }}</dd>
          </div>
          <div>
            <dt>Registry</dt>
            <dd>{{ registryAddress || "-" }}</dd>
          </div>
        </dl>
        <dl v-if="providerDeployment">
          <div>
            <dt>内核提供方</dt>
            <dd>{{ providerDeployment.registryAdmin }}</dd>
          </div>
          <div>
            <dt>协议版本</dt>
            <dd>{{ providerDeployment.version }}</dd>
          </div>
          <div>
            <dt>注册表</dt>
            <dd>{{ providerDeployment.registry }}</dd>
          </div>
        </dl>
        <div v-if="deployedGames.length" class="game-list">
          <h3>游戏对接方</h3>
          <article v-for="game in deployedGames" :key="game.gameId.toString()">
            <p><strong>Game ID</strong><span>{{ game.gameId }}</span></p>
            <p><strong>对接方</strong><span>{{ game.operator }}</span></p>
            <p><strong>版本</strong><span>{{ game.version }}</span></p>
            <p><strong>ToolNFT</strong><span>{{ game.toolNFT }}</span></p>
            <p><strong>MiningCore</strong><span>{{ game.miningCore }}</span></p>
            <p><strong>ResourceToken</strong><span>{{ game.resourceToken }}</span></p>
          </article>
        </div>
      </section>

      <section class="panel large-panel">
        <div class="panel-title">
          <span>02</span>
          <h2>游戏方创建实例</h2>
        </div>
        <div class="form-grid">
          <label>
            Factory
            <input v-model="createFactoryAddress" placeholder="0x..." />
          </label>
          <label>
            工具名称
            <input v-model="gameConfig.toolName" />
          </label>
          <label>
            工具符号
            <input v-model="gameConfig.toolSymbol" />
          </label>
          <label>
            资源名称
            <input v-model="gameConfig.resourceName" />
          </label>
          <label>
            资源符号
            <input v-model="gameConfig.resourceSymbol" />
          </label>
          <label>
            工具有效期（天）
            <input v-model="gameConfig.toolDurationDays" inputmode="numeric" />
          </label>
          <label>
            初始奖励额度
            <input v-model="gameConfig.initialRewards" />
          </label>
          <label>
            每日释放上限
            <input v-model="gameConfig.dailyEmissionCap" />
          </label>
          <label>
            赛季释放上限
            <input v-model="gameConfig.seasonEmissionCap" />
          </label>
          <label>
            释放周期（天）
            <input v-model="gameConfig.emissionDays" inputmode="numeric" />
          </label>
          <label>
            基础产出
            <input v-model="gameConfig.baseReward" />
          </label>
          <label>
            冷却时间（秒）
            <input v-model="gameConfig.cooldownSeconds" inputmode="numeric" />
          </label>
          <label>
            耐久消耗
            <input v-model="gameConfig.durabilityCost" inputmode="numeric" />
          </label>
          <label>
            等级倍率 bps
            <input v-model="gameConfig.levelMultiplierBps" inputmode="numeric" />
          </label>
          <label>
            算力倍率 bps
            <input v-model="gameConfig.powerMultiplierBps" inputmode="numeric" />
          </label>
          <label>
            升级消耗
            <input v-model="gameConfig.upgradeCost" />
          </label>
          <label>
            升级增加算力
            <input v-model="gameConfig.upgradePowerIncrease" inputmode="numeric" />
          </label>
          <label>
            升级增加耐久
            <input v-model="gameConfig.upgradeDurabilityIncrease" inputmode="numeric" />
          </label>
        </div>

        <div class="inline-options">
          <label>
            <input v-model="gameConfig.activateOnMint" type="checkbox" />
            购买后立即激活
          </label>
          <label>
            <input v-model="gameConfig.expiredTransferable" type="checkbox" />
            过期后可转移
          </label>
        </div>

        <div class="form-grid tool-grid">
          <label>
            工具类型
            <input v-model="toolTypeConfig.toolType" inputmode="numeric" />
          </label>
          <label>
            价格
            <input v-model="toolTypeConfig.price" />
          </label>
          <label>
            最大供应量
            <input v-model="toolTypeConfig.maxSupply" inputmode="numeric" />
          </label>
          <label>
            算力
            <input v-model="toolTypeConfig.power" inputmode="numeric" />
          </label>
          <label>
            耐久
            <input v-model="toolTypeConfig.durability" inputmode="numeric" />
          </label>
          <label>
            元数据 URI
            <input v-model="toolTypeConfig.metadataURI" />
          </label>
        </div>

        <div class="button-row">
          <button :disabled="!canUseWallet || busy" @click="createGame">创建游戏</button>
        </div>
        <dl v-if="createdGame">
          <div>
            <dt>游戏 ID</dt>
            <dd>{{ createdGame.gameId }}</dd>
          </div>
          <div>
            <dt>ToolNFT</dt>
            <dd>{{ createdGame.toolNFT }}</dd>
          </div>
          <div>
            <dt>MiningCore</dt>
            <dd>{{ createdGame.miningCore }}</dd>
          </div>
          <div>
            <dt>ResourceToken</dt>
            <dd>{{ createdGame.resourceToken }}</dd>
          </div>
        </dl>

        <div class="subsection">
          <div class="panel-title compact-title">
            <span>查</span>
            <h2>游戏方查询</h2>
          </div>
          <div class="form-grid">
            <label>
              游戏方地址
              <input v-model="operatorQueryAddress" placeholder="默认当前钱包地址" />
            </label>
            <label>
              Registry
              <input v-model="registryAddress" placeholder="0x..." />
            </label>
            <label>
              工具类型扫描上限
              <input v-model="toolTypeScanLimit" inputmode="numeric" />
            </label>
          </div>
          <button :disabled="!canUseWallet || busy" @click="loadOperatorGames">查询已创建游戏</button>

          <div v-if="operatorGames.length" class="game-list">
            <h3>已创建游戏</h3>
            <article v-for="game in operatorGames" :key="game.gameId.toString()">
              <p><strong>Game ID</strong><span>{{ game.gameId }}</span></p>
              <p><strong>游戏方</strong><span>{{ game.operator }}</span></p>
              <p><strong>Factory</strong><span>{{ game.factory }}</span></p>
              <p><strong>版本</strong><span>{{ game.version }}</span></p>
              <p><strong>ToolNFT</strong><span>{{ game.toolNFT }}</span></p>
              <p><strong>MiningCore</strong><span>{{ game.miningCore }}</span></p>
              <div class="button-row">
                <button type="button" :disabled="busy" @click="openToolTypeDialog(game)">新增/配置 NFT 工具</button>
                <button type="button" :disabled="busy" @click="loadCreatedToolTypes(game)">查询工具 NFT</button>
                <button
                  type="button"
                  :disabled="busy"
                  @click="gameId = game.gameId.toString()"
                >
                  选为当前游戏
                </button>
              </div>
            </article>
          </div>

          <div v-if="selectedOperatorGame" class="game-list">
            <h3>游戏 {{ selectedOperatorGame.gameId }} 的工具 NFT 类型</h3>
            <article v-if="!createdToolTypes.length">
              <p><strong>结果</strong><span>扫描范围内没有已配置工具类型。</span></p>
            </article>
            <article v-for="tool in createdToolTypes" :key="tool.toolType.toString()">
              <p><strong>工具类型</strong><span>{{ tool.toolType }}</span></p>
              <p><strong>价格</strong><span>{{ formatEther(tool.price) }}</span></p>
              <p><strong>供应量</strong><span>{{ tool.minted }} / {{ tool.maxSupply }}</span></p>
              <p><strong>算力</strong><span>{{ tool.power }}</span></p>
              <p><strong>耐久</strong><span>{{ tool.durability }}</span></p>
              <p><strong>元数据</strong><span>{{ tool.metadataURI }}</span></p>
            </article>
          </div>
        </div>
      </section>

      <section class="panel large-panel">
        <div class="panel-title">
          <span>03</span>
          <h2>玩家使用</h2>
        </div>
        <div class="form-grid">
          <label>
            Registry
            <input v-model="registryAddress" placeholder="0x..." />
          </label>
          <label>
            游戏 ID
            <input v-model="gameId" inputmode="numeric" />
          </label>
          <label>
            玩家地址
            <input v-model="playerAddress" placeholder="0x..." />
          </label>
          <label>
            工具类型
            <input v-model="selectedToolType" inputmode="numeric" />
          </label>
          <label>
            工具 ID
            <input v-model="selectedToolId" inputmode="numeric" />
          </label>
        </div>
        <div class="button-row">
          <button :disabled="!canUseWallet || busy" @click="loadGame">加载游戏</button>
          <button :disabled="!gameClient || busy" @click="refreshToolType">读取类型</button>
          <button :disabled="!gameClient || busy" @click="buyTool">购买工具</button>
          <button :disabled="!gameClient || busy" @click="refreshToolStatus">读取工具</button>
          <button :disabled="!gameClient || busy" @click="mineTool">挖矿</button>
          <button :disabled="!gameClient || busy" @click="approveAndUpgrade">授权并升级</button>
          <button :disabled="!gameClient || busy" @click="refreshBalance">查询余额</button>
        </div>

        <div class="data-grid">
          <article>
            <h3>游戏实例</h3>
            <p v-for="(value, key) in gameAddresses" :key="key">
              <strong>{{ key }}</strong>
              <span>{{ value }}</span>
            </p>
          </article>
          <article>
            <h3>工具类型</h3>
            <p v-if="toolTypeInfo"><strong>价格</strong><span>{{ formatEther(toolTypeInfo.price) }}</span></p>
            <p v-if="toolTypeInfo"><strong>供应量</strong><span>{{ toolTypeInfo.minted }} / {{ toolTypeInfo.maxSupply }}</span></p>
            <p v-if="toolTypeInfo"><strong>算力</strong><span>{{ toolTypeInfo.power }}</span></p>
            <p v-if="toolTypeInfo"><strong>耐久</strong><span>{{ toolTypeInfo.durability }}</span></p>
          </article>
          <article>
            <h3>工具</h3>
            <p v-if="toolStatus"><strong>持有人</strong><span>{{ toolStatus.owner }}</span></p>
            <p v-if="toolStatus"><strong>有效</strong><span>{{ toolStatus.active }}</span></p>
            <p v-if="toolStatus"><strong>可挖</strong><span>{{ toolStatus.canMine }}</span></p>
            <p v-if="toolStatus"><strong>预计产出</strong><span>{{ formatEther(toolStatus.pendingReward) }}</span></p>
            <p v-if="toolStatus"><strong>等级</strong><span>{{ toolStatus.level }}</span></p>
            <p v-if="toolStatus"><strong>耐久</strong><span>{{ toolStatus.durability }}</span></p>
          </article>
          <article>
            <h3>资源</h3>
            <p><strong>查询余额</strong><span>{{ resourceBalance === null ? "-" : formatEther(resourceBalance) }}</span></p>
          </article>
        </div>
      </section>
    </div>
  </main>

  <Teleport to="body">
    <div v-if="toolTypeDialogOpen" class="modal-backdrop" @click.self="closeToolTypeDialog">
      <section class="modal-panel">
        <div class="modal-header">
          <div>
            <p class="eyebrow">游戏 {{ toolTypeDialogGame?.gameId }}</p>
            <h2>新增/配置 NFT 工具</h2>
          </div>
          <button type="button" class="secondary-button" :disabled="busy" @click="closeToolTypeDialog">关闭</button>
        </div>

        <dl v-if="toolTypeDialogGame" class="modal-meta">
          <div>
            <dt>ToolNFT</dt>
            <dd>{{ toolTypeDialogGame.toolNFT }}</dd>
          </div>
          <div>
            <dt>MiningCore</dt>
            <dd>{{ toolTypeDialogGame.miningCore }}</dd>
          </div>
        </dl>

        <div class="form-grid tool-grid">
          <label>
            工具类型
            <input v-model="toolTypeConfig.toolType" inputmode="numeric" />
          </label>
          <label>
            价格
            <input v-model="toolTypeConfig.price" />
          </label>
          <label>
            最大供应量
            <input v-model="toolTypeConfig.maxSupply" inputmode="numeric" />
          </label>
          <label>
            算力
            <input v-model="toolTypeConfig.power" inputmode="numeric" />
          </label>
          <label>
            耐久
            <input v-model="toolTypeConfig.durability" inputmode="numeric" />
          </label>
          <label>
            元数据 URI
            <input v-model="toolTypeConfig.metadataURI" />
          </label>
        </div>

        <div class="button-row">
          <button type="button" :disabled="!canUseWallet || busy || !toolTypeDialogGame" @click="configureToolType">
            提交配置
          </button>
          <button type="button" class="secondary-button" :disabled="busy" @click="closeToolTypeDialog">取消</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
