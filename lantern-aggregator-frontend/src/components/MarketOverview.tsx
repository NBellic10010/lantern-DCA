import { useState, useEffect } from 'react';
import { Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Button, Spinner } from '@heroui/react';
import { addToast } from '@heroui/react';

// API 配置
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 交易对数据类型
interface PairInfo {
  name: string;
  base: string;
  quote: string;
  price: number | null;
  liquidity: number | null;
  feeRate: number | null;
  poolAddress: string;
  lastUpdated: string;
}

interface AllPoolsResponse {
  pairs: PairInfo[];
  totalPairs: number;
  availablePairs: number;
  lastUpdated: string;
}

// 币种图标映射
const COIN_ICONS: Record<string, string> = {
  'SUI': '🔷',
  'USDC': '💵',
  'CETUS': '🐬',
  'WBTC': '₿',
  'FDUSD': '💴',
  'SCA': '⭐',
  'APT': '🔷',
  'VSB': '🚀',
};

// 格式化流动性
function formatLiquidity(liquidity: number | null): string {
  if (liquidity === null) return 'N/A';
  if (liquidity < 1e6) return `$${(liquidity / 1e6).toFixed(2)}M`;
  if (liquidity < 1e9) return `$${(liquidity / 1e6).toFixed(1)}M`;
  return `$${(liquidity / 1e9).toFixed(2)}B`;
}

// 格式化价格
function formatPrice(price: number | null): string {
  if (price === null) return 'N/A';
  if (price < 0.01) return price.toExponential(4);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
}

export function MarketOverview() {
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 获取市场数据
  const fetchMarketData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cetus/pairs`);
      if (!response.ok) throw new Error('Failed to fetch market data');

      const data: AllPoolsResponse = await response.json();
      setPairs(data.pairs);
      setLastUpdated(new Date(data.lastUpdated));
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      addToast({
        title: 'Error',
        description: 'Failed to fetch market data',
        color: 'danger',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始加载和定时刷新
  useEffect(() => {
    fetchMarketData();

    // 每60秒自动刷新
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMarketData();
  };

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardBody className="flex items-center justify-center py-12">
          <Spinner size="lg" color="primary" label="Loading market data..." />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden shadow-lg border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-100">
            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Market Overview</h3>
            <p className="text-xs text-gray-500">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
            </p>
          </div>
        </div>

        <Button
          isLoading={refreshing}
          variant="flat"
          color="primary"
          size="sm"
          onClick={handleRefresh}
          startContent={
            !refreshing ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : undefined
          }
        >
          Refresh
        </Button>
      </div>

      {/* Table */}
      <CardBody className="p-0">
        <Table aria-label="Market pairs" classNames={{ wrapper: 'max-h-[500px] overflow-auto' }}>
          <TableHeader>
            <TableColumn className="bg-gray-50/50">PAIR</TableColumn>
            <TableColumn className="text-right bg-gray-50/50">PRICE</TableColumn>
            <TableColumn className="text-right bg-gray-50/50">LIQUIDITY</TableColumn>
            <TableColumn className="text-right bg-gray-50/50">FEE</TableColumn>
            <TableColumn className="text-right bg-gray-50/50">POOL</TableColumn>
          </TableHeader>
          <TableBody>
            {pairs.map((pair) => {
              const [baseCoin, quoteCoin] = pair.name.split('/');
              const baseIcon = COIN_ICONS[baseCoin] || '🪙';
              const quoteIcon = COIN_ICONS[quoteCoin] || '🪙';

              return (
                <TableRow key={pair.name} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        <span className="text-lg">{baseIcon}</span>
                        <span className="text-lg">{quoteIcon}</span>
                      </div>
                      <span className="font-semibold text-gray-800">{pair.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={pair.price ? 'text-gray-800' : 'text-gray-400'}>
                      {formatPrice(pair.price)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={pair.liquidity && pair.liquidity > 1e7 ? 'success' : 'default'}
                      className="font-mono"
                    >
                      {formatLiquidity(pair.liquidity)}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-right">
                    <Chip size="sm" variant="flat" color="warning" className="font-mono">
                      {pair.feeRate !== null ? `${pair.feeRate.toFixed(2)}%` : 'N/A'}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-right">
                    {pair.poolAddress ? (
                      <Button
                        size="sm"
                        variant="light"
                        color="primary"
                        className="text-xs h-6 min-w-0 px-2"
                        onClick={() => {
                          navigator.clipboard.writeText(pair.poolAddress);
                          addToast({
                            title: 'Copied',
                            description: 'Pool address copied to clipboard',
                            color: 'success',
                          });
                        }}
                      >
                        {pair.poolAddress.slice(0, 6)}...{pair.poolAddress.slice(-4)}
                      </Button>
                    ) : (
                      <span className="text-gray-400 text-xs">N/A</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}

