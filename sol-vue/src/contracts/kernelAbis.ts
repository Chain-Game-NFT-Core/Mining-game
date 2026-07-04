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
  }
] as const;
