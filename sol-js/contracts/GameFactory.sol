// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GameRegistry.sol";
import "./MiningCore.sol";
import "./ResourceToken.sol";
import "./RewardVault.sol";
import "./RuleModuleV1.sol";
import "./ToolNFT.sol";

contract GameFactory {
    string public constant VERSION = "0.1.0";
    GameRegistry public immutable registry;
    address public immutable registryAdmin;

    struct ToolTypeConfig {
        uint256 toolType;
        uint256 price;
        uint256 maxSupply;
        uint256 power;
        uint256 durability;
        string metadataURI;
    }

    struct GameConfig {
        string toolName;
        string toolSymbol;
        string resourceName;
        string resourceSymbol;
        uint256 toolDuration;
        bool activateOnMint;
        bool expiredTransferable;
        uint256 initialRewards;
        uint256 dailyEmissionCap;
        uint256 seasonEmissionCap;
        uint256 emissionStart;
        uint256 emissionEnd;
        uint256 baseReward;
        uint256 cooldown;
        uint256 durabilityCost;
        uint256 levelMultiplierBps;
        uint256 powerMultiplierBps;
        uint256 upgradeCost;
        uint256 upgradePowerIncrease;
        uint256 upgradeDurabilityIncrease;
    }

    event GameCreated(
        uint256 indexed gameId,
        address indexed operator,
        address toolNFT,
        address miningCore,
        address resourceToken,
        address rewardVault,
        string version
    );

    modifier onlyRegistryAdmin() {
        require(msg.sender == registryAdmin, "NOT_REGISTRY_ADMIN");
        _;
    }

    constructor(address initialRegistryAdmin, address existingRegistry) {
        require(initialRegistryAdmin != address(0), "ADMIN_ZERO");
        registryAdmin = initialRegistryAdmin;
        if (existingRegistry == address(0)) {
            registry = new GameRegistry(initialRegistryAdmin, address(this));
        } else {
            registry = GameRegistry(existingRegistry);
        }
    }

    function setGameStatus(
        uint256 gameId,
        GameRegistry.VerificationStatus status,
        string calldata riskTag
    ) external onlyRegistryAdmin {
        registry.setGameStatus(gameId, status, riskTag);
    }

    function createGame(
        GameConfig calldata config,
        ToolTypeConfig[] calldata toolTypes
    )
        external
        returns (
            uint256 gameId,
            address toolNFT,
            address miningCore,
            address resourceToken,
            address rewardVault,
            address ruleModule
        )
    {
        require(toolTypes.length > 0, "NO_TOOL_TYPES");
        ToolNFT tool = new ToolNFT(
            config.toolName,
            config.toolSymbol,
            config.toolDuration,
            config.activateOnMint,
            config.expiredTransferable,
            address(this)
        );
        ResourceToken resource = new ResourceToken(config.resourceName, config.resourceSymbol, address(this));
        RewardVault vault = new RewardVault(
            config.initialRewards,
            config.dailyEmissionCap,
            config.seasonEmissionCap,
            config.emissionStart,
            config.emissionEnd,
            address(this)
        );
        RuleModuleV1 rules = new RuleModuleV1(
            config.baseReward,
            config.cooldown,
            config.durabilityCost,
            config.levelMultiplierBps,
            config.powerMultiplierBps
        );
        MiningCore core = new MiningCore(
            address(tool),
            address(resource),
            address(vault),
            address(rules),
            config.upgradeCost,
            config.upgradePowerIncrease,
            config.upgradeDurabilityIncrease,
            msg.sender
        );

        tool.setMiningCore(address(core));
        resource.setMinter(address(core));
        vault.setMiningCore(address(core));

        for (uint256 i = 0; i < toolTypes.length; i++) {
            tool.configureToolType(
                toolTypes[i].toolType,
                toolTypes[i].price,
                toolTypes[i].maxSupply,
                toolTypes[i].power,
                toolTypes[i].durability,
                toolTypes[i].metadataURI
            );
        }

        tool.transferOwnership(msg.sender);
        resource.transferOwnership(msg.sender);
        vault.transferOwnership(msg.sender);

        gameId = registry.registerGame(
            msg.sender,
            address(tool),
            address(core),
            address(resource),
            address(vault),
            VERSION
        );

        toolNFT = address(tool);
        miningCore = address(core);
        resourceToken = address(resource);
        rewardVault = address(vault);
        ruleModule = address(rules);

        emit GameCreated(gameId, msg.sender, toolNFT, miningCore, resourceToken, rewardVault, VERSION);
    }
}
