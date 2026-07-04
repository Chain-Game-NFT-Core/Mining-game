// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Ownable.sol";

contract GameRegistry is Ownable {
    enum VerificationStatus {
        Permissionless,
        Verified,
        Audited,
        Featured,
        Deprecated
    }

    struct GameRecord {
        uint256 gameId;
        address operator;
        address factory;
        address toolNFT;
        address miningCore;
        address resourceToken;
        address rewardVault;
        string version;
        VerificationStatus status;
        string riskTag;
        bool exists;
    }

    struct ProtocolRelease {
        string version;
        address factory;
        string metadataURI;
        bool active;
        bool exists;
    }

    uint256 public nextGameId = 1;
    mapping(uint256 => GameRecord) private records;
    mapping(address => bool) public authorizedRegistrars;
    mapping(bytes32 => ProtocolRelease) private releases;
    mapping(uint256 => uint256) public recommendedUpgradeOf;
    mapping(uint256 => uint256) public previousGameOf;
    mapping(uint256 => string) public migrationURIOf;

    event GameRegistered(
        uint256 indexed gameId,
        address indexed operator,
        address indexed factory,
        address toolNFT,
        address miningCore,
        address resourceToken,
        address rewardVault,
        string version
    );
    event GameStatusUpdated(uint256 indexed gameId, VerificationStatus status, string riskTag);
    event RegistrarUpdated(address indexed registrar, bool authorized);
    event ProtocolReleaseUpdated(string version, address indexed factory, string metadataURI, bool active);
    event GameUpgradeRecommended(
        uint256 indexed fromGameId,
        uint256 indexed toGameId,
        address indexed operator,
        string migrationURI
    );

    constructor(address initialOwner, address initialRegistrar) Ownable(initialOwner) {
        require(initialRegistrar != address(0), "REGISTRAR_ZERO");
        authorizedRegistrars[initialRegistrar] = true;
        emit RegistrarUpdated(initialRegistrar, true);
    }

    modifier onlyRegistrar() {
        require(authorizedRegistrars[msg.sender], "NOT_REGISTRAR");
        _;
    }

    function setRegistrar(address registrar, bool authorized) external onlyOwner {
        require(registrar != address(0), "REGISTRAR_ZERO");
        authorizedRegistrars[registrar] = authorized;
        emit RegistrarUpdated(registrar, authorized);
    }

    function setProtocolRelease(
        string calldata version,
        address factory,
        string calldata metadataURI,
        bool active
    ) external onlyOwner {
        require(bytes(version).length > 0, "VERSION_EMPTY");
        require(factory != address(0), "FACTORY_ZERO");
        bytes32 key = keccak256(bytes(version));
        releases[key] = ProtocolRelease({
            version: version,
            factory: factory,
            metadataURI: metadataURI,
            active: active,
            exists: true
        });
        emit ProtocolReleaseUpdated(version, factory, metadataURI, active);
    }

    function registerGame(
        address operator,
        address toolNFT,
        address miningCore,
        address resourceToken,
        address rewardVault,
        string calldata version
    ) external onlyRegistrar returns (uint256 gameId) {
        require(operator != address(0), "OPERATOR_ZERO");
        require(toolNFT != address(0), "TOOL_ZERO");
        require(miningCore != address(0), "CORE_ZERO");
        require(resourceToken != address(0), "RESOURCE_ZERO");
        require(rewardVault != address(0), "VAULT_ZERO");

        gameId = nextGameId++;
        records[gameId] = GameRecord({
            gameId: gameId,
            operator: operator,
            factory: msg.sender,
            toolNFT: toolNFT,
            miningCore: miningCore,
            resourceToken: resourceToken,
            rewardVault: rewardVault,
            version: version,
            status: VerificationStatus.Permissionless,
            riskTag: "",
            exists: true
        });

        emit GameRegistered(gameId, operator, msg.sender, toolNFT, miningCore, resourceToken, rewardVault, version);
    }

    function setGameStatus(uint256 gameId, VerificationStatus status, string calldata riskTag) external onlyOwner {
        require(records[gameId].exists, "GAME_NOT_FOUND");
        records[gameId].status = status;
        records[gameId].riskTag = riskTag;
        emit GameStatusUpdated(gameId, status, riskTag);
    }

    function getGame(uint256 gameId) external view returns (GameRecord memory) {
        require(records[gameId].exists, "GAME_NOT_FOUND");
        return records[gameId];
    }

    function getProtocolRelease(string calldata version) external view returns (ProtocolRelease memory) {
        ProtocolRelease memory release = releases[keccak256(bytes(version))];
        require(release.exists, "RELEASE_NOT_FOUND");
        return release;
    }

    function recommendGameUpgrade(
        uint256 fromGameId,
        uint256 toGameId,
        string calldata migrationURI
    ) external {
        GameRecord memory fromGame = records[fromGameId];
        GameRecord memory toGame = records[toGameId];
        require(fromGame.exists, "FROM_GAME_NOT_FOUND");
        require(toGame.exists, "TO_GAME_NOT_FOUND");
        require(msg.sender == fromGame.operator, "NOT_OPERATOR");
        require(toGame.operator == fromGame.operator, "OPERATOR_MISMATCH");
        require(fromGameId != toGameId, "SAME_GAME");

        recommendedUpgradeOf[fromGameId] = toGameId;
        previousGameOf[toGameId] = fromGameId;
        migrationURIOf[fromGameId] = migrationURI;

        emit GameUpgradeRecommended(fromGameId, toGameId, msg.sender, migrationURI);
    }

    function getRecommendedUpgrade(uint256 gameId) external view returns (
        uint256 toGameId,
        string memory migrationURI
    ) {
        require(records[gameId].exists, "GAME_NOT_FOUND");
        return (recommendedUpgradeOf[gameId], migrationURIOf[gameId]);
    }
}
