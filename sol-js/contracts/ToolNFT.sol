// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Ownable.sol";

contract ToolNFT is Ownable {
    struct ToolType {
        uint256 price;
        uint256 maxSupply;
        uint256 minted;
        uint256 power;
        uint256 durability;
        string metadataURI;
        bool exists;
    }

    struct Tool {
        uint256 toolType;
        uint256 mintedAt;
        uint256 activatedAt;
        uint256 expireAt;
        uint256 power;
        uint256 durability;
        uint256 level;
        uint256 lastUsedAt;
    }

    string public name;
    string public symbol;
    uint256 public immutable toolDuration;
    bool public immutable activateOnMint;
    bool public immutable expiredTransferable;
    uint256 public nextToolId = 1;
    address public miningCore;

    mapping(uint256 => ToolType) public toolTypes;
    mapping(uint256 => Tool) public tools;
    mapping(uint256 => address) private owners;
    mapping(address => uint256) private balances;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event ToolTypeConfigured(uint256 indexed toolType, uint256 price, uint256 maxSupply, uint256 power, uint256 durability);
    event ToolMinted(address indexed player, uint256 indexed toolId, uint256 toolType);
    event ToolActivated(uint256 indexed toolId, uint256 activatedAt, uint256 expireAt);
    event MiningCoreUpdated(address indexed miningCore);
    event ToolUsed(uint256 indexed toolId, uint256 durabilityAfter, uint256 lastUsedAt);
    event ToolUpgraded(uint256 indexed toolId, uint256 oldLevel, uint256 newLevel);

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint256 duration,
        bool shouldActivateOnMint,
        bool allowExpiredTransfer,
        address initialOwner
    ) Ownable(initialOwner) {
        require(duration > 0, "DURATION_ZERO");
        name = tokenName;
        symbol = tokenSymbol;
        toolDuration = duration;
        activateOnMint = shouldActivateOnMint;
        expiredTransferable = allowExpiredTransfer;
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

    function configureToolType(
        uint256 toolType,
        uint256 price,
        uint256 maxSupply,
        uint256 power,
        uint256 durability,
        string calldata metadataURI
    ) external onlyOwner {
        require(toolType != 0, "TYPE_ZERO");
        require(maxSupply > 0, "SUPPLY_ZERO");
        require(power > 0, "POWER_ZERO");
        require(durability > 0, "DURABILITY_ZERO");
        ToolType storage current = toolTypes[toolType];
        require(current.minted == 0 || current.maxSupply == maxSupply, "SUPPLY_IMMUTABLE");
        toolTypes[toolType] = ToolType({
            price: price,
            maxSupply: maxSupply,
            minted: current.minted,
            power: power,
            durability: durability,
            metadataURI: metadataURI,
            exists: true
        });
        emit ToolTypeConfigured(toolType, price, maxSupply, power, durability);
    }

    function buyTool(uint256 toolType) external payable returns (uint256 toolId) {
        ToolType storage config = toolTypes[toolType];
        require(config.exists, "TYPE_NOT_FOUND");
        require(config.minted < config.maxSupply, "SOLD_OUT");
        require(msg.value == config.price, "PRICE");

        config.minted += 1;
        toolId = nextToolId++;
        uint256 activatedAt = activateOnMint ? block.timestamp : 0;
        uint256 expireAt = activateOnMint ? block.timestamp + toolDuration : 0;
        tools[toolId] = Tool({
            toolType: toolType,
            mintedAt: block.timestamp,
            activatedAt: activatedAt,
            expireAt: expireAt,
            power: config.power,
            durability: config.durability,
            level: 1,
            lastUsedAt: 0
        });

        _mint(msg.sender, toolId);
        emit ToolMinted(msg.sender, toolId, toolType);
        if (activateOnMint) {
            emit ToolActivated(toolId, activatedAt, expireAt);
        }
    }

    function activate(uint256 toolId) external {
        require(ownerOf(toolId) == msg.sender, "NOT_TOOL_OWNER");
        _activate(toolId);
    }

    function activateFromCore(uint256 toolId) external onlyMiningCore {
        _activate(toolId);
    }

    function markUsed(uint256 toolId, uint256 durabilityCost) external onlyMiningCore {
        Tool storage tool = tools[toolId];
        require(tool.durability >= durabilityCost, "DURABILITY");
        tool.durability -= durabilityCost;
        tool.lastUsedAt = block.timestamp;
        emit ToolUsed(toolId, tool.durability, block.timestamp);
    }

    function upgradeFromCore(uint256 toolId, uint256 powerIncrease, uint256 durabilityIncrease) external onlyMiningCore {
        Tool storage tool = tools[toolId];
        uint256 oldLevel = tool.level;
        tool.level += 1;
        tool.power += powerIncrease;
        tool.durability += durabilityIncrease;
        emit ToolUpgraded(toolId, oldLevel, tool.level);
    }

    function isActive(uint256 toolId) public view returns (bool) {
        Tool memory tool = tools[toolId];
        return tool.activatedAt != 0 && block.timestamp <= tool.expireAt && tool.durability > 0;
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = owners[tokenId];
        require(tokenOwner != address(0), "NOT_MINTED");
        return tokenOwner;
    }

    function balanceOf(address account) external view returns (uint256) {
        require(account != address(0), "ACCOUNT_ZERO");
        return balances[account];
    }

    function approve(address spender, uint256 tokenId) external {
        address tokenOwner = ownerOf(tokenId);
        require(msg.sender == tokenOwner || isApprovedForAll[tokenOwner][msg.sender], "NOT_APPROVED");
        getApproved[tokenId] = spender;
        emit Approval(tokenOwner, spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "NOT_APPROVED");
        require(ownerOf(tokenId) == from, "FROM");
        require(to != address(0), "TO_ZERO");
        if (!expiredTransferable) {
            Tool memory tool = tools[tokenId];
            require(tool.expireAt == 0 || block.timestamp <= tool.expireAt, "EXPIRED_TRANSFER");
        }
        delete getApproved[tokenId];
        balances[from] -= 1;
        balances[to] += 1;
        owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        Tool memory tool = tools[tokenId];
        require(tool.mintedAt != 0, "NOT_MINTED");
        return toolTypes[tool.toolType].metadataURI;
    }

    function withdraw(address payable to) external onlyOwner {
        require(to != address(0), "TO_ZERO");
        to.transfer(address(this).balance);
    }

    function _activate(uint256 toolId) internal {
        Tool storage tool = tools[toolId];
        require(tool.mintedAt != 0, "NOT_MINTED");
        require(tool.activatedAt == 0, "ACTIVATED");
        tool.activatedAt = block.timestamp;
        tool.expireAt = block.timestamp + toolDuration;
        emit ToolActivated(toolId, tool.activatedAt, tool.expireAt);
    }

    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "TO_ZERO");
        owners[tokenId] = to;
        balances[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return spender == tokenOwner || getApproved[tokenId] == spender || isApprovedForAll[tokenOwner][spender];
    }
}
