// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RuleModuleV1 {
    uint256 public baseReward;
    uint256 public cooldown;
    uint256 public durabilityCost;
    uint256 public levelMultiplierBps;
    uint256 public powerMultiplierBps;

    event ParameterChanged(bytes32 indexed key, uint256 oldValue, uint256 newValue);

    constructor(
        uint256 initialBaseReward,
        uint256 initialCooldown,
        uint256 initialDurabilityCost,
        uint256 initialLevelMultiplierBps,
        uint256 initialPowerMultiplierBps
    ) {
        require(initialBaseReward > 0, "REWARD_ZERO");
        require(initialDurabilityCost > 0, "DURABILITY_ZERO");
        baseReward = initialBaseReward;
        cooldown = initialCooldown;
        durabilityCost = initialDurabilityCost;
        levelMultiplierBps = initialLevelMultiplierBps;
        powerMultiplierBps = initialPowerMultiplierBps;
    }

    function calculateReward(uint256 power, uint256 level) external view returns (uint256) {
        uint256 powerFactor = 10_000 + (power * powerMultiplierBps);
        uint256 levelFactor = 10_000 + ((level - 1) * levelMultiplierBps);
        return (baseReward * powerFactor * levelFactor) / 100_000_000;
    }
}
