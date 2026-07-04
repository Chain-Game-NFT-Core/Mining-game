// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Ownable.sol";
import "./ResourceToken.sol";
import "./RewardVault.sol";
import "./RuleModuleV1.sol";
import "./ToolNFT.sol";

contract MiningCore is Ownable {
    ToolNFT public immutable toolNFT;
    ResourceToken public immutable resourceToken;
    RewardVault public immutable rewardVault;
    RuleModuleV1 public ruleModule;
    bool public paused;
    uint256 public upgradeCost;
    uint256 public upgradePowerIncrease;
    uint256 public upgradeDurabilityIncrease;

    event Mined(
        address indexed player,
        uint256 indexed toolId,
        uint256 indexed toolType,
        uint256 rewardAmount,
        uint256 minedAt
    );
    event RuleModuleUpdated(address indexed ruleModule);
    event Paused(bool paused);
    event ParameterChanged(bytes32 indexed key, uint256 oldValue, uint256 newValue);

    constructor(
        address tool,
        address resource,
        address vault,
        address rules,
        uint256 initialUpgradeCost,
        uint256 initialUpgradePowerIncrease,
        uint256 initialUpgradeDurabilityIncrease,
        address initialOwner
    ) Ownable(initialOwner) {
        require(tool != address(0), "TOOL_ZERO");
        require(resource != address(0), "RESOURCE_ZERO");
        require(vault != address(0), "VAULT_ZERO");
        require(rules != address(0), "RULES_ZERO");
        toolNFT = ToolNFT(tool);
        resourceToken = ResourceToken(resource);
        rewardVault = RewardVault(vault);
        ruleModule = RuleModuleV1(rules);
        upgradeCost = initialUpgradeCost;
        upgradePowerIncrease = initialUpgradePowerIncrease;
        upgradeDurabilityIncrease = initialUpgradeDurabilityIncrease;
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }

    function setRuleModule(address rules) external onlyOwner {
        require(rules != address(0), "RULES_ZERO");
        ruleModule = RuleModuleV1(rules);
        emit RuleModuleUpdated(rules);
    }

    function setUpgradeConfig(uint256 cost, uint256 powerIncrease, uint256 durabilityIncrease) external onlyOwner {
        emit ParameterChanged(bytes32("upgradeCost"), upgradeCost, cost);
        upgradeCost = cost;
        upgradePowerIncrease = powerIncrease;
        upgradeDurabilityIncrease = durabilityIncrease;
    }

    function mine(uint256 toolId) public {
        require(!paused, "PAUSED");
        require(toolNFT.ownerOf(toolId) == msg.sender, "NOT_TOOL_OWNER");
        if (!toolNFT.isActive(toolId)) {
            toolNFT.activateFromCore(toolId);
        }
        require(canMine(toolId), "CANNOT_MINE");
        uint256 rewardAmount = pendingReward(toolId);
        rewardVault.reserve(msg.sender, rewardAmount);
        uint256 durabilityCost = ruleModule.durabilityCost();
        toolNFT.markUsed(toolId, durabilityCost);
        resourceToken.mint(msg.sender, rewardAmount);

        (uint256 toolType,,,,,,,) = toolNFT.tools(toolId);
        emit Mined(msg.sender, toolId, toolType, rewardAmount, block.timestamp);
    }

    function mineBatch(uint256[] calldata toolIds) external {
        for (uint256 i = 0; i < toolIds.length; i++) {
            mine(toolIds[i]);
        }
    }

    function upgradeTool(uint256 toolId) external {
        require(toolNFT.ownerOf(toolId) == msg.sender, "NOT_TOOL_OWNER");
        require(toolNFT.isActive(toolId), "INACTIVE");
        if (upgradeCost > 0) {
            resourceToken.burnFrom(msg.sender, upgradeCost);
        }
        toolNFT.upgradeFromCore(toolId, upgradePowerIncrease, upgradeDurabilityIncrease);
    }

    function pendingReward(uint256 toolId) public view returns (uint256) {
        (,,,, uint256 power,, uint256 level,) = toolNFT.tools(toolId);
        return ruleModule.calculateReward(power, level);
    }

    function canMine(uint256 toolId) public view returns (bool) {
        if (paused || !toolNFT.isActive(toolId)) {
            return false;
        }
        (,,,,, uint256 durability,, uint256 lastUsedAt) = toolNFT.tools(toolId);
        if (durability < ruleModule.durabilityCost()) {
            return false;
        }
        if (lastUsedAt != 0 && block.timestamp < lastUsedAt + ruleModule.cooldown()) {
            return false;
        }
        return rewardVault.canReserve(pendingReward(toolId));
    }
}
