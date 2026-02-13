// 不要去链上动态查，直接写死！
export const SUPPORTED_PAIRS = {
    "SUI-USDC": {
      name: "SUI / USDC",
      pool_id: "0x...你的Testnet_SUI_USDC_Pool_ID...", 
      coin_a: { symbol: "SUI", type: "0x2::sui::SUI", decimals: 9 },
      coin_b: { symbol: "USDC", type: "0x...::usdc::USDC", decimals: 6 },
      is_stable: false // 只是个标记
    },
    "CETUS-SUI": {
      name: "CETUS / SUI",
      pool_id: "0x...你的Testnet_CETUS_SUI_Pool_ID...",
      coin_a: { symbol: "CETUS", type: "0x...::cetus::CETUS", decimals: 9 },
      coin_b: { symbol: "SUI", type: "0x2::sui::SUI", decimals: 9 },
      is_stable: false
    }
  };