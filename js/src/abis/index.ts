export const gameRegistryAbi = [
  {
    type: "function",
    name: "nextGameId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "getGame",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "gameId", type: "uint256" },
          { name: "operator", type: "address" },
          { name: "factory", type: "address" },
          { name: "toolNFT", type: "address" },
          { name: "miningCore", type: "address" },
          { name: "resourceToken", type: "address" },
          { name: "rewardVault", type: "address" },
          { name: "version", type: "string" },
          { name: "status", type: "uint8" },
          { name: "riskTag", type: "string" },
          { name: "exists", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getRecommendedUpgrade",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "toGameId", type: "uint256" },
      { name: "migrationURI", type: "string" }
    ]
  },
  {
    type: "function",
    name: "getProtocolRelease",
    stateMutability: "view",
    inputs: [{ name: "version", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "version", type: "string" },
          { name: "factory", type: "address" },
          { name: "metadataURI", type: "string" },
          { name: "active", type: "bool" },
          { name: "exists", type: "bool" }
        ]
      }
    ]
  }
] as const;

export const toolNftAbi = [
  {
    type: "function",
    name: "configureToolType",
    stateMutability: "nonpayable",
    inputs: [
      { name: "toolType", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "maxSupply", type: "uint256" },
      { name: "power", type: "uint256" },
      { name: "durability", type: "uint256" },
      { name: "metadataURI", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "buyTool",
    stateMutability: "payable",
    inputs: [{ name: "toolType", type: "uint256" }],
    outputs: [{ name: "toolId", type: "uint256" }]
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "isActive",
    stateMutability: "view",
    inputs: [{ name: "toolId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "tools",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "toolType", type: "uint256" },
      { name: "mintedAt", type: "uint256" },
      { name: "activatedAt", type: "uint256" },
      { name: "expireAt", type: "uint256" },
      { name: "power", type: "uint256" },
      { name: "durability", type: "uint256" },
      { name: "level", type: "uint256" },
      { name: "lastUsedAt", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "toolTypes",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "maxSupply", type: "uint256" },
      { name: "minted", type: "uint256" },
      { name: "power", type: "uint256" },
      { name: "durability", type: "uint256" },
      { name: "metadataURI", type: "string" },
      { name: "exists", type: "bool" }
    ]
  },
  {
    type: "event",
    name: "ToolMinted",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "toolId", type: "uint256", indexed: true },
      { name: "toolType", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "ToolActivated",
    inputs: [
      { name: "toolId", type: "uint256", indexed: true },
      { name: "activatedAt", type: "uint256", indexed: false },
      { name: "expireAt", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "ToolUpgraded",
    inputs: [
      { name: "toolId", type: "uint256", indexed: true },
      { name: "oldLevel", type: "uint256", indexed: false },
      { name: "newLevel", type: "uint256", indexed: false }
    ]
  }
] as const;

export const miningCoreAbi = [
  {
    type: "function",
    name: "mine",
    stateMutability: "nonpayable",
    inputs: [{ name: "toolId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "mineBatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "toolIds", type: "uint256[]" }],
    outputs: []
  },
  {
    type: "function",
    name: "upgradeTool",
    stateMutability: "nonpayable",
    inputs: [{ name: "toolId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "pendingReward",
    stateMutability: "view",
    inputs: [{ name: "toolId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "canMine",
    stateMutability: "view",
    inputs: [{ name: "toolId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "event",
    name: "Mined",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "toolId", type: "uint256", indexed: true },
      { name: "toolType", type: "uint256", indexed: true },
      { name: "rewardAmount", type: "uint256", indexed: false },
      { name: "minedAt", type: "uint256", indexed: false }
    ]
  }
] as const;

export const resourceTokenAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "event",
    name: "ResourceMinted",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "resourceId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "ResourceBurned",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "resourceId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false }
    ]
  }
] as const;
