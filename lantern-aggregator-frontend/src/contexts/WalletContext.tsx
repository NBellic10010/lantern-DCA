import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Button, Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip, addToast } from '@heroui/react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

// 钱包连接状态
interface WalletState {
  connected: boolean;
  address: string | null;
  balance: number;
  loading: boolean;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    balance: 0,
    loading: false,
  });

  // 初始化时检查是否已连接钱包
  useEffect(() => {
    const checkConnection = async () => {
      // 检查浏览器扩展钱包 (Sui Wallet)
      if (typeof window !== 'undefined' && (window as any).suiWallet) {
        try {
          const accounts = await (window as any).suiWallet.getAccounts();
          if (accounts && accounts.length > 0) {
            await connectWallet();
          }
        } catch (e) {
          console.log('No wallet connected');
        }
      }
    };
    checkConnection();
  }, []);

  const connect = async () => {
    await connectWallet();
  };

  const connectWallet = async () => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      if (typeof window !== 'undefined' && (window as any).suiWallet) {
        // 使用 Sui Wallet 扩展
        const accounts = await (window as any).suiWallet.getAccounts();
        if (accounts && accounts.length > 0) {
          const address = accounts[0];
          setState({
            connected: true,
            address,
            balance: 0, // 稍后获取余额
            loading: false,
          });
          await refreshBalance();
          addToast({
            title: 'Wallet Connected',
            description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
            color: 'success',
          });
          return;
        }
      }

      // 模拟连接 (开发环境)
      const mockAddress = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      setState({
        connected: true,
        address: mockAddress,
        balance: Math.random() * 10000 + 1000,
        loading: false,
      });
      addToast({
        title: 'Wallet Connected (Dev Mode)',
        description: `Connected to ${mockAddress.slice(0, 6)}...${mockAddress.slice(-4)}`,
        color: 'warning',
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setState(prev => ({ ...prev, loading: false }));
      addToast({
        title: 'Connection Failed',
        description: 'Please install Sui Wallet extension',
        color: 'danger',
      });
    }
  };

  const disconnect = () => {
    setState({
      connected: false,
      address: null,
      balance: 0,
      loading: false,
    });
    addToast({
      title: 'Wallet Disconnected',
      color: 'default',
    });
  };

  const refreshBalance = async () => {
    if (!state.address) return;

    try {
      const client = new SuiClient({ url: getFullnodeUrl('testnet') });
      const coins = await client.getCoins({
        owner: state.address,
        coinType: '0x2::sui::SUI',
      });

      const totalBalance = coins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
      const balanceInSui = Number(totalBalance) / 1e9;

      setState(prev => ({ ...prev, balance: balanceInSui }));
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, refreshBalance }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// 钱包连接按钮组件
export function WalletButton() {
  const { connected, address, balance, loading, connect, disconnect } = useWallet();

  if (loading) {
    return (
      <Button isLoading color="primary" variant="flat">
        Connecting...
      </Button>
    );
  }

  if (connected && address) {
    return (
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button
            variant="flat"
            color="primary"
            className="gap-2"
            startContent={
              <Avatar
                size="sm"
                src=""
                name={address.slice(0, 2)}
                className="bg-primary-500 text-white"
              />
            }
          >
            <span className="hidden sm:inline">{balance.toFixed(2)} SUI</span>
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Wallet Actions" variant="flat">
          <DropdownItem
            key="address"
            className="opacity-100"
            isReadOnly
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Connected Wallet</span>
              <span className="font-mono text-sm">{address}</span>
            </div>
          </DropdownItem>
          <DropdownItem
            key="balance"
            className="opacity-100"
            isReadOnly
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Balance</span>
              <span className="font-semibold">{balance.toFixed(4)} SUI</span>
            </div>
          </DropdownItem>
          <DropdownItem key="disconnect" color="danger" onClick={disconnect}>
            Disconnect
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }

  return (
    <Button color="primary" variant="solid" onClick={connect}>
      Connect Wallet
    </Button>
  );
}

