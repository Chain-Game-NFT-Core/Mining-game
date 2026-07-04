// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Ownable.sol";

contract RewardVault is Ownable {
    uint256 public dailyEmissionCap;
    uint256 public seasonEmissionCap;
    uint256 public remainingRewards;
    uint256 public emissionStart;
    uint256 public emissionEnd;
    bool public paused;
    address public miningCore;

    mapping(uint256 => uint256) public emittedByDay;
    uint256 public seasonEmitted;

    event RewardFunded(uint256 amount, uint256 remainingRewards);
    event RewardReserved(address indexed player, uint256 amount, uint256 day, uint256 seasonEmitted);
    event MiningCoreUpdated(address indexed miningCore);
    event Paused(bool paused);
    event ParameterChanged(bytes32 indexed key, uint256 oldValue, uint256 newValue);

    constructor(
        uint256 initialRewards,
        uint256 dailyCap,
        uint256 seasonCap,
        uint256 start,
        uint256 end,
        address initialOwner
    ) Ownable(initialOwner) {
        require(dailyCap > 0, "DAILY_ZERO");
        require(seasonCap > 0, "SEASON_ZERO");
        require(end > start, "WINDOW");
        remainingRewards = initialRewards;
        dailyEmissionCap = dailyCap;
        seasonEmissionCap = seasonCap;
        emissionStart = start;
        emissionEnd = end;
    }

    modifier onlyMiningCore() {
        require(msg.sender == miningCore, "NOT_CORE");
        _;
    }

    function setMiningCore(address core) external onlyOwner {
        require(core != address(0), "CORE_ZERO");
        miningCore = core;
        emit MiningCoreUpdated(core);
    }

    function fund(uint256 amount) external onlyOwner {
        remainingRewards += amount;
        emit RewardFunded(amount, remainingRewards);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }

    function setDailyEmissionCap(uint256 value) external onlyOwner {
        require(value > 0, "DAILY_ZERO");
        uint256 oldValue = dailyEmissionCap;
        dailyEmissionCap = value;
        emit ParameterChanged(bytes32("dailyEmissionCap"), oldValue, value);
    }

    function setSeasonEmissionCap(uint256 value) external onlyOwner {
        require(value > 0, "SEASON_ZERO");
        uint256 oldValue = seasonEmissionCap;
        seasonEmissionCap = value;
        emit ParameterChanged(bytes32("seasonEmissionCap"), oldValue, value);
    }

    function canReserve(uint256 amount) public view returns (bool) {
        if (paused || block.timestamp < emissionStart || block.timestamp > emissionEnd) {
            return false;
        }
        uint256 day = block.timestamp / 1 days;
        return remainingRewards >= amount
            && emittedByDay[day] + amount <= dailyEmissionCap
            && seasonEmitted + amount <= seasonEmissionCap;
    }

    function reserve(address player, uint256 amount) external onlyMiningCore {
        require(canReserve(amount), "EMISSION_CAP");
        uint256 day = block.timestamp / 1 days;
        remainingRewards -= amount;
        emittedByDay[day] += amount;
        seasonEmitted += amount;
        emit RewardReserved(player, amount, day, seasonEmitted);
    }
}
