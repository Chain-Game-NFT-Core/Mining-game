import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ethers, network } from "hardhat";

describe("On-chain mining game kernel", function () {
  async function deployGame() {
    const [operator, player] = await ethers.getSigners();
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const Factory = await ethers.getContractFactory("GameFactory");
    const factory = await Factory.deploy(operator.address, ethers.ZeroAddress);
    await factory.waitForDeployment();

    const config = {
      toolName: "Mining Tool",
      toolSymbol: "MTL",
      resourceName: "Ore",
      resourceSymbol: "ORE",
      toolDuration: 30 * 24 * 60 * 60,
      activateOnMint: false,
      expiredTransferable: false,
      initialRewards: ethers.parseEther("100000"),
      dailyEmissionCap: ethers.parseEther("1000"),
      seasonEmissionCap: ethers.parseEther("10000"),
      emissionStart: now,
      emissionEnd: now + 60 * 24 * 60 * 60,
      baseReward: ethers.parseEther("10"),
      cooldown: 3600,
      durabilityCost: 1,
      levelMultiplierBps: 1000,
      powerMultiplierBps: 1000
    };
    const createArgs = [
      {
        ...config,
        upgradeCost: ethers.parseEther("5"),
        upgradePowerIncrease: 2,
        upgradeDurabilityIncrease: 3
      },
      [
        {
          toolType: 1,
          price: ethers.parseEther("0.1"),
          maxSupply: 100,
          power: 10,
          durability: 5,
          metadataURI: "ipfs://tool-1"
        }
      ]
    ] as const;

    const predicted = await factory.connect(operator).createGame.staticCall(...createArgs);
    await factory.connect(operator).createGame(...createArgs);

    const toolNFT = await ethers.getContractAt("ToolNFT", predicted.toolNFT);
    const miningCore = await ethers.getContractAt("MiningCore", predicted.miningCore);
    const resourceToken = await ethers.getContractAt("ResourceToken", predicted.resourceToken);
    const rewardVault = await ethers.getContractAt("RewardVault", predicted.rewardVault);

    return { operator, player, factory, toolNFT, miningCore, resourceToken, rewardVault };
  }

  it("deploys a registered game through the factory", async function () {
    const { operator, factory, toolNFT, miningCore, resourceToken, rewardVault } = await deployGame();
    const registryAddress = await factory.registry();
    const registry = await ethers.getContractAt("GameRegistry", registryAddress);
    const game = await registry.getGame(1);

    expect(game.operator).to.equal(operator.address);
    expect(game.toolNFT).to.equal(await toolNFT.getAddress());
    expect(game.miningCore).to.equal(await miningCore.getAddress());
    expect(game.resourceToken).to.equal(await resourceToken.getAddress());
    expect(game.rewardVault).to.equal(await rewardVault.getAddress());
    expect(await toolNFT.owner()).to.equal(operator.address);
    expect(game.factory).to.equal(await factory.getAddress());
  });

  it("supports shared registries, protocol releases, and game upgrade recommendations", async function () {
    const { operator, factory } = await deployGame();
    const registryAddress = await factory.registry();
    const registry = await ethers.getContractAt("GameRegistry", registryAddress);

    await expect(registry.connect(operator).setProtocolRelease("0.1.0", await factory.getAddress(), "ipfs://v0.1.0", true))
      .to.emit(registry, "ProtocolReleaseUpdated")
      .withArgs("0.1.0", await factory.getAddress(), "ipfs://v0.1.0", true);

    const Factory = await ethers.getContractFactory("GameFactory");
    const nextFactory = await Factory.deploy(operator.address, registryAddress);
    await nextFactory.waitForDeployment();

    await registry.connect(operator).setRegistrar(await nextFactory.getAddress(), true);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const config = {
      toolName: "Mining Tool V2",
      toolSymbol: "MTL2",
      resourceName: "Ore V2",
      resourceSymbol: "ORE2",
      toolDuration: 30 * 24 * 60 * 60,
      activateOnMint: false,
      expiredTransferable: false,
      initialRewards: ethers.parseEther("200000"),
      dailyEmissionCap: ethers.parseEther("2000"),
      seasonEmissionCap: ethers.parseEther("20000"),
      emissionStart: now,
      emissionEnd: now + 60 * 24 * 60 * 60,
      baseReward: ethers.parseEther("10"),
      cooldown: 1800,
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
        maxSupply: 100,
        power: 10,
        durability: 5,
        metadataURI: "ipfs://tool-1-v2"
      }
    ];

    const predicted = await nextFactory.connect(operator).createGame.staticCall(config, toolTypes);
    await nextFactory.connect(operator).createGame(config, toolTypes);

    expect(predicted.gameId).to.equal(2);
    expect((await registry.getGame(2)).factory).to.equal(await nextFactory.getAddress());

    await expect(registry.connect(operator).recommendGameUpgrade(1, 2, "ipfs://migration-v2"))
      .to.emit(registry, "GameUpgradeRecommended")
      .withArgs(1, 2, operator.address, "ipfs://migration-v2");

    const [toGameId, migrationURI] = await registry.getRecommendedUpgrade(1);
    expect(toGameId).to.equal(2);
    expect(migrationURI).to.equal("ipfs://migration-v2");
  });

  it("lets a player buy, mine, wait for cooldown, and upgrade a tool", async function () {
    const { player, toolNFT, miningCore, resourceToken } = await deployGame();

    await expect(toolNFT.connect(player).buyTool(1, { value: ethers.parseEther("0.1") }))
      .to.emit(toolNFT, "ToolMinted")
      .withArgs(player.address, 1, 1);

    expect(await miningCore.canMine(1)).to.equal(false);

    await expect(miningCore.connect(player).mine(1))
      .to.emit(miningCore, "Mined")
      .withArgs(player.address, 1, 1, ethers.parseEther("20"), anyValue);

    expect(await resourceToken.balanceOf(player.address)).to.equal(ethers.parseEther("20"));
    expect(await miningCore.canMine(1)).to.equal(false);

    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");
    expect(await miningCore.canMine(1)).to.equal(true);

    await resourceToken.connect(player).approve(await miningCore.getAddress(), ethers.parseEther("5"));
    await expect(miningCore.connect(player).upgradeTool(1)).to.emit(toolNFT, "ToolUpgraded").withArgs(1, 1, 2);
    expect(await resourceToken.balanceOf(player.address)).to.equal(ethers.parseEther("15"));
  });

  it("enforces reward caps", async function () {
    const { operator, player, rewardVault, toolNFT, miningCore } = await deployGame();
    await rewardVault.connect(operator).setDailyEmissionCap(ethers.parseEther("1"));
    await toolNFT.connect(player).buyTool(1, { value: ethers.parseEther("0.1") });
    await expect(miningCore.connect(player).mine(1)).to.be.revertedWith("CANNOT_MINE");
  });
});
