'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RefreshCw, Plus, ArrowRight, Wallet, TrendingUp, DollarSign } from 'lucide-react';

// --- Interfaces matching new backend logic ---

interface PortfolioPosition {
  assetId: number;
  symbol: string;
  name: string;
  shares: number;
  avgCost?: number;
  price: number;
  currentValue: number;      // shares * price
  cost?: number;             // shares * avgCost
  profitLoss?: number;       // currentValue - cost
  profitLossPercent?: number; // (profitLoss / cost) * 100
  currentPercent: number;    // of total portfolio
  targetPercent: number;     // target allocation
  targetValue: number;
  driftValue: number;        // difference (positive = need buy)
  actionShares: number;      // suggested buy/sell shares
}

interface PortfolioAccount {
  id: number;
  name: string;
  platform?: string;
  marketType: string;        // "exchange" 场内, "otc" 场外
  cash: number;
  totalValue: number;        // cash + holdings
  holdingsValue: number;
  targetAmount?: number;     // Optional target total amount
}

interface PortfolioResponse {
  account: PortfolioAccount;
  positions: PortfolioPosition[];
}

// --- Main Component ---

export default function Home() {
  const [portfolios, setPortfolios] = useState<PortfolioResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingPrices, setRefreshingPrices] = useState(false);

  // Dialog States
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [isTxOpen, setIsTxOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAllocationOpen, setIsAllocationOpen] = useState(false);
  const [isAssetManageOpen, setIsAssetManageOpen] = useState(false);
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [isDepositCashOpen, setIsDepositCashOpen] = useState(false);
    const [isManualHoldingOpen, setIsManualHoldingOpen] = useState(false);
  
  // Selection Context
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<number | null>(null);
  const [accountForAllocation, setAccountForAllocation] = useState<number | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<PortfolioAccount | null>(null);
  const [accountForDeposit, setAccountForDeposit] = useState<PortfolioAccount | null>(null);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  
  // Forms Data
  const [allocations, setAllocations] = useState<any[]>([]);
  const [newAllocation, setNewAllocation] = useState({ 
    assetType: 'existing', // 'existing' or 'new'
    assetId: '', 
    targetPercent: '',
    newAssetName: '',
    newAssetSymbol: ''
  });
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [newAccount, setNewAccount] = useState({ name: '', platform: '', marketType: 'exchange', cash: '0' });
  const [editAccountData, setEditAccountData] = useState({ name: '', platform: '', marketType: 'exchange', targetAmount: '', cash: '' });
  const [editingAssetData, setEditingAssetData] = useState({ name: '', type: '', currentPrice: '' });
  const [depositAmount, setDepositAmount] = useState('');
    const [manualHoldingAccount, setManualHoldingAccount] = useState<PortfolioAccount | null>(null);
    const [manualHolding, setManualHolding] = useState({
        assetType: 'existing', // existing | new
        assetId: '',
        symbol: '',
        name: '',
        shares: '',
        avgCost: '',
        currentPrice: ''
    });
  const [newTx, setNewTx] = useState({ 
    accountId: 0, 
    type: 'buy', 
    symbol: '', 
    shares: '0', 
    price: '', 
    date: '' 
  });

  // Init Date on client only to avoid hydration mismatch
  useEffect(() => {
    setNewTx(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
  }, []);

  // --- Data Fetching ---

  const fetchAllPortfolios = async () => {
    setLoading(true);
    try {
      // 1. Get List of Accounts
      const accRes = await fetch('/api/accounts');
            const accountsPayload = await accRes.json();

            if (!accRes.ok) {
                const message =
                    (accountsPayload && accountsPayload.error) ||
                    '账户列表获取失败';
                throw new Error(message);
            }

            const accounts = Array.isArray(accountsPayload) ? accountsPayload : [];

            if (accounts.length === 0) {
                setPortfolios([]);
                return;
            }
      
      // 2. Fetch Portfolio for each account (Parallel)
      const promises = accounts.map((acc: any) => 
        fetch(`/api/portfolio?accountId=${acc.id}`).then(r => r.json())
      );
      
      const portfolioData = await Promise.all(promises);
      setPortfolios(portfolioData.filter(p => !p.error));
    } catch (error) {
      console.error('Failed to load data', error);
            setPortfolios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPortfolios();
    fetchAvailableAssets();
  }, []);

  const handleRefreshPrices = async () => {
    setRefreshingPrices(true);
    try {
        await fetch('/api/prices/refresh', { method: 'POST' });
        await fetchAllPortfolios(); // Reload data after price update
    } catch(e) {
        alert('行情更新失败');
    } finally {
        setRefreshingPrices(false);
    }
  };

  // --- Actions ---

  const handleCreateAccount = async () => {
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newAccount, targetAmount: 0 }),
    });
    setIsAddAccountOpen(false);
    setNewAccount({ name: '', platform: '', marketType: 'exchange', cash: '0' });
    fetchAllPortfolios();
  };

  const handleUpdateAccount = async () => {
    if (!accountToEdit) return;
    
    // Validate target amount if provided
    let target = null;
    if (editAccountData.targetAmount && editAccountData.targetAmount.trim() !== '') {
        target = parseFloat(editAccountData.targetAmount);
        if (isNaN(target) || target < 0) {
            return alert('请输入有效的预设投入金额');
        }
    }

    // Validate cash if provided
    let newCash = null;
    if (editAccountData.cash && editAccountData.cash.trim() !== '') {
        newCash = parseFloat(editAccountData.cash);
        if (isNaN(newCash)) {
            return alert('请输入有效的现金余额');
        }
    }

    const res = await fetch(`/api/accounts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: accountToEdit.id,
            name: editAccountData.name,
            platform: editAccountData.platform,
            marketType: editAccountData.marketType,
            targetAmount: target,
            cash: newCash
        }),
    });

    if (res.ok) {
        setIsEditAccountOpen(false);
        setAccountToEdit(null);
        fetchAllPortfolios();
    } else {
        const err = await res.json();
        alert(err.error || '账户更新失败');
    }
  };

  const handleCreateTransaction = async () => {
    if (!newTx.accountId) return alert('请选择账户');
    if (!newTx.symbol && !newTx.price) return alert('请输入代码');
    
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newTx,
        shares: parseFloat(newTx.shares),
        price: newTx.price ? parseFloat(newTx.price) : null,
      }),
    });
    
    if (res.ok) {
        setIsTxOpen(false);
        setNewTx({ accountId: 0, type: 'buy', symbol: '', shares: '0', price: '', date: new Date().toISOString().split('T')[0] });
        fetchAllPortfolios();
    } else {
        const err = await res.json();
        alert(err.error || '交易创建失败');
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    
    const res = await fetch(`/api/accounts?id=${accountToDelete}`, {
      method: 'DELETE',
    });
    
    if (res.ok) {
        setIsDeleteOpen(false);
        setAccountToDelete(null);
        fetchAllPortfolios();
    } else {
        const err = await res.json();
        alert(err.error || '账户删除失败');
    }
  };

  // --- Asset Management Functions ---

  const handleUpdateAsset = async () => {
    if (!editingAsset) return;

    const res = await fetch('/api/assets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingAsset.id,
        name: editingAssetData.name,
        type: editingAssetData.type,
        currentPrice: editingAssetData.currentPrice ? parseFloat(editingAssetData.currentPrice) : undefined,
      }),
    });

    if (res.ok) {
      setIsEditAssetOpen(false);
      setEditingAsset(null);
      setEditingAssetData({ name: '', type: '', currentPrice: '' });
      await fetchAvailableAssets();
    } else {
      const err = await res.json();
      alert(err.error || '资产更新失败');
    }
  };

  const handleDeleteAsset = async (assetId: number) => {
    const asset = availableAssets.find(a => a.id === assetId);
    const warningMsg = asset?.symbol 
      ? `确定要删除 ${asset.name || asset.symbol}？此操作不可撤销。`
      : '确定要删除该资产？此操作不可撤销。';
    
    if (!confirm(warningMsg)) return;

    const res = await fetch(`/api/assets?id=${assetId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      await fetchAvailableAssets();
      alert('资产删除成功');
    } else {
      const err = await res.json();
      alert(err.error || '删除失败');
    }
  };

  const openEditAssetDialog = (asset: any) => {
    setEditingAsset(asset);
    setEditingAssetData({
      name: asset.name || '',
      type: asset.type || 'stock',
      currentPrice: asset.currentPrice ? asset.currentPrice.toString() : '',
    });
    setIsEditAssetOpen(true);
  };

  // --- Asset Allocation Functions ---  

  const fetchAllocations = async (accountId: number) => {
    try {
      const res = await fetch(`/api/allocations?accountId=${accountId}`);
      const data = await res.json();
      setAllocations(data);
    } catch (error) {
      console.error('Failed to fetch allocations', error);
    }
  };

  const fetchAvailableAssets = async () => {
    try {
      const res = await fetch('/api/assets');
      const data = await res.json();
      setAvailableAssets(data);
    } catch (error) {
      console.error('Failed to fetch assets', error);
    }
  };

  const handleAddAllocation = async () => {
    if (!accountForAllocation || !newAllocation.targetPercent) {
      return alert('请填写完整的配置信息');
    }
    
    const newPercent = parseFloat(newAllocation.targetPercent);
    const currentTotal = allocations.reduce((sum, alloc) => sum + alloc.targetPercent, 0);
    
    if (currentTotal + newPercent > 100) {
      return alert('配置比例总和不能超过100%');
    }
    
    let assetId: number;
    
    if (newAllocation.assetType === 'new') {
      // Create new asset first
      if (!newAllocation.newAssetName || !newAllocation.newAssetSymbol) {
        return alert('请填写新资产的名称和代码');
      }
      
      const assetRes = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAllocation.newAssetName,
          symbol: newAllocation.newAssetSymbol,
          type: 'stock', // Default type
          currentPrice: 0, // Default price
        }),
      });
      
      if (!assetRes.ok) {
        const err = await assetRes.json();
        return alert(err.error || '创建新资产失败');
      }
      
      const newAsset = await assetRes.json();
      assetId = newAsset.id;
    } else {
      // Use existing asset
      if (!newAllocation.assetId) {
        return alert('请选择资产');
      }
      assetId = parseInt(newAllocation.assetId);
    }
    
    // Create allocation
    const res = await fetch('/api/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: accountForAllocation,
        assetId: assetId,
        targetPercent: newPercent,
      }),
    });
    
    if (res.ok) {
      setNewAllocation({ 
        assetType: 'existing', 
        assetId: '', 
        targetPercent: '',
        newAssetName: '',
        newAssetSymbol: ''
      });
      await fetchAllocations(accountForAllocation);
      await fetchAvailableAssets(); // Refresh asset list
      fetchAllPortfolios();
    } else {
      const err = await res.json();
      alert(err.error || '添加配置失败');
    }
  };

  const handleUpdateAllocation = async (id: number, targetPercent: number) => {
    const currentTotal = allocations.reduce((sum, alloc) => 
      sum + (alloc.id === id ? 0 : alloc.targetPercent), 0
    );
    
    if (currentTotal + targetPercent > 100) {
      return alert('配置比例总和不能超过100%');
    }
    
    const res = await fetch(`/api/allocations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPercent }),
    });
    
    if (res.ok) {
      await fetchAllocations(accountForAllocation!);
      fetchAllPortfolios();
    } else {
      const err = await res.json();
      alert(err.error || '更新配置失败');
    }
  };

  const handleDeleteAllocation = async (id: number) => {
    if (confirm('确定要删除这个配置吗？')) {
      const res = await fetch(`/api/allocations/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await fetchAllocations(accountForAllocation!);
        fetchAllPortfolios();
      } else {
        const err = await res.json();
        alert(err.error || '删除配置失败');
      }
    }
  };

  const openAllocationDialog = async (accountId: number) => {
    setAccountForAllocation(accountId);
    await Promise.all([
      fetchAllocations(accountId),
      fetchAvailableAssets()
    ]);
    setIsAllocationOpen(true);
  };

  // --- Helpers ---
  
  const openTxDialog = (accountId: number) => {
      setSelectedAccountId(accountId);
      setNewTx(prev => ({ ...prev, accountId, type: 'buy', symbol: '', price: '' }));
      setIsTxOpen(true);
  };
  
  const openSellDialog = (accountId: number, symbol: string, currentShares: number) => {
      setSelectedAccountId(accountId);
      setNewTx(prev => ({ 
          ...prev, 
          accountId, 
          type: 'sell', 
          symbol, 
          shares: currentShares.toString(),
          price: '' 
      }));
      setIsTxOpen(true);
  };

  const openDeleteDialog = (accountId: number) => {
      setAccountToDelete(accountId);
      setIsDeleteOpen(true);
  };

  const openEditDialog = (account: PortfolioAccount) => {
      setAccountToEdit(account);
      setEditAccountData({
          name: account.name,
          platform: account.platform || '',
          marketType: account.marketType || 'exchange',
          targetAmount: account.targetAmount ? account.targetAmount.toString() : '',
          cash: account.cash.toString()
      });
      setIsEditAccountOpen(true);
  };

  const openDepositDialog = (account: PortfolioAccount) => {
      setAccountForDeposit(account);
      setDepositAmount('');
      setIsDepositCashOpen(true);
  };

  const openManualHoldingDialog = (account: PortfolioAccount) => {
      setManualHoldingAccount(account);
      setManualHolding({
        assetType: 'existing',
        assetId: '',
        symbol: '',
        name: '',
        shares: '',
        avgCost: '',
        currentPrice: ''
      });
      setIsManualHoldingOpen(true);
  };

  const handleRecordManualHolding = async () => {
      if (!manualHoldingAccount) return;

      if (!manualHolding.shares || isNaN(parseFloat(manualHolding.shares)) || parseFloat(manualHolding.shares) < 0) {
          return alert('请输入有效份额（>=0）');
      }

      if (manualHolding.assetType === 'existing' && !manualHolding.assetId) {
          return alert('请选择资产');
      }

      if (manualHolding.assetType === 'new' && !manualHolding.symbol.trim()) {
          return alert('请输入资产代码');
      }

      const payload: any = {
          accountId: manualHoldingAccount.id,
          shares: parseFloat(manualHolding.shares),
      };

      if (manualHolding.avgCost.trim() !== '') {
          payload.avgCost = parseFloat(manualHolding.avgCost);
      }

      if (manualHolding.currentPrice.trim() !== '') {
          payload.currentPrice = parseFloat(manualHolding.currentPrice);
      }

      if (manualHolding.assetType === 'existing') {
          payload.assetId = parseInt(manualHolding.assetId);
      } else {
          payload.symbol = manualHolding.symbol.trim();
          payload.name = manualHolding.name.trim() || manualHolding.symbol.trim();
          payload.assetType = 'fund';
      }

      const res = await fetch('/api/holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
      });

      if (res.ok) {
          setIsManualHoldingOpen(false);
          setManualHoldingAccount(null);
          await fetchAvailableAssets();
          await fetchAllPortfolios();
      } else {
          const err = await res.json();
          alert(err.error || '记录份额失败');
      }
  };

  const handleDepositCash = async () => {
      if (!accountForDeposit || !depositAmount) {
          return alert('请输入转入金额');
      }

      const amount = parseFloat(depositAmount);
      if (isNaN(amount) || amount <= 0) {
          return alert('请输入有效的正数金额');
      }

      const newCash = accountForDeposit.cash + amount;

      const res = await fetch('/api/accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              id: accountForDeposit.id,
              cash: newCash
          }),
      });

      if (res.ok) {
          setIsDepositCashOpen(false);
          setAccountForDeposit(null);
          setDepositAmount('');
          fetchAllPortfolios();
      } else {
          alert('转入失败');
      }
  };

  const totalAssets = portfolios.reduce((sum, p) => sum + p.account.totalValue, 0);

  return (
    <div className="container mx-auto p-6 space-y-8">
      
      {/* 1. Header & Dashboard Summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">资产配置仪表盘</h1>
          <p className="text-muted-foreground mt-1">
             当前总资产: <span className="text-2xl font-mono text-primary font-bold" suppressHydrationWarning>¥{totalAssets.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefreshPrices} disabled={refreshingPrices}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshingPrices ? 'animate-spin' : ''}`} />
                {refreshingPrices ? '更新最新行情...' : '刷新市值'}
            </Button>
            <Button variant="outline" onClick={() => setIsAssetManageOpen(true)}>
                📊 资产管理
            </Button>
            <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
                <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/> 新建账户</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>创建新账户</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">名称</Label>
                            <Input value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">平台</Label>
                            <Input value={newAccount.platform} onChange={e => setNewAccount({...newAccount, platform: e.target.value})} className="col-span-3" placeholder="例如: 华泰证券" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">市场类型</Label>
                            <Select value={newAccount.marketType} onValueChange={val => setNewAccount({...newAccount, marketType: val})}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="exchange">场内（股票/ETF）</SelectItem>
                                    <SelectItem value="otc">场外（基金/银行理财）</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateAccount}>创建</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>编辑账户</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">名称</Label>
                            <Input value={editAccountData.name} onChange={e => setEditAccountData({...editAccountData, name: e.target.value})} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">平台</Label>
                            <Input value={editAccountData.platform} onChange={e => setEditAccountData({...editAccountData, platform: e.target.value})} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">市场类型</Label>
                            <Select value={editAccountData.marketType} onValueChange={val => setEditAccountData({...editAccountData, marketType: val})}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="exchange">场内（股票/ETF）</SelectItem>
                                    <SelectItem value="otc">场外（基金/银行理财）</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">预设投入(¥)</Label>
                            <Input 
                                type="number" 
                                value={editAccountData.targetAmount} 
                                onChange={e => setEditAccountData({...editAccountData, targetAmount: e.target.value})} 
                                className="col-span-3" 
                                placeholder="留空则按当前净值计算"
                            />
                            <p className="col-span-4 text-xs text-muted-foreground text-right">
                                如果设置了预设投入金额，分配比例将基于该金额计算，否则基于当前净值（持仓+现金）计算。
                            </p>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">现金余额(¥)</Label>
                            <Input 
                                type="number" 
                                value={editAccountData.cash} 
                                onChange={e => setEditAccountData({...editAccountData, cash: e.target.value})} 
                                className="col-span-3" 
                                placeholder="账户现金余额"
                            />
                            <p className="col-span-4 text-xs text-muted-foreground text-right">
                                可以直接修改账户的现金余额，负数表示融资/借贷状态。
                            </p>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleUpdateAccount}>保存修改</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAssetManageOpen} onOpenChange={setIsAssetManageOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>资产管理</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        {availableAssets.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">暂无资产</p>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {availableAssets.map((asset) => (
                                    <div key={asset.id} className="flex items-center justify-between p-3 border rounded">
                                        <div>
                                            <div className="font-medium">{asset.name || asset.symbol}</div>
                                            <div className="text-xs text-muted-foreground">{asset.symbol}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                onClick={() => openEditAssetDialog(asset)}
                                            >
                                                编辑
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="destructive"
                                                onClick={() => handleDeleteAsset(asset.id)}
                                            >
                                                删除
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditAssetOpen} onOpenChange={setIsEditAssetOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>编辑资产</DialogTitle></DialogHeader>
                    {editingAsset && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">代码</Label>
                                <Input value={editingAsset.symbol} disabled className="col-span-3 bg-gray-100" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">名称</Label>
                                <Input 
                                    value={editingAssetData.name} 
                                    onChange={e => setEditingAssetData({...editingAssetData, name: e.target.value})} 
                                    className="col-span-3" 
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">类型</Label>
                                <Select value={editingAssetData.type} onValueChange={val => setEditingAssetData({...editingAssetData, type: val})}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="stock">股票</SelectItem>
                                        <SelectItem value="fund">基金</SelectItem>
                                        <SelectItem value="bond">债券</SelectItem>
                                        <SelectItem value="crypto">加密货币</SelectItem>
                                        <SelectItem value="other">其他</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">当前价格</Label>
                                <Input 
                                    type="number" 
                                    value={editingAssetData.currentPrice} 
                                    onChange={e => setEditingAssetData({...editingAssetData, currentPrice: e.target.value})} 
                                    className="col-span-3" 
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter><Button onClick={handleUpdateAsset}>保存</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDepositCashOpen} onOpenChange={setIsDepositCashOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>转入现金</DialogTitle></DialogHeader>
                    {accountForDeposit && (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">账户: {accountForDeposit.name}</p>
                                <p className="text-sm text-muted-foreground">当前现金: ¥{accountForDeposit.cash.toLocaleString()}</p>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">转入金额(¥)</Label>
                                <Input 
                                    type="number" 
                                    value={depositAmount} 
                                    onChange={e => setDepositAmount(e.target.value)} 
                                    className="col-span-3" 
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                                <p>转入后现金余额:</p>
                                <p className="text-lg font-bold">
                                    ¥{((accountForDeposit.cash + (depositAmount ? parseFloat(depositAmount) : 0)) || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDepositCashOpen(false)}>取消</Button>
                        <Button onClick={handleDepositCash}>确认转入</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </div>


      {loading && <div className="text-center py-10">加载数据中...</div>}

      {/* 2. Portfolio Cards */}
      {!loading && portfolios.map((portfolio) => (
        <Card key={portfolio.account.id} className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-gray-500"/> {portfolio.account.name}
                        {portfolio.account.marketType === 'otc' && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">场外</span>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(portfolio.account)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </Button>
                    </CardTitle>
                    <CardDescription>
                        {portfolio.account.cash !== 0 && (
                            <span className={portfolio.account.cash < 0 ? "text-red-500 font-bold mr-1" : "mr-1"}>
                                现金余额: ¥{portfolio.account.cash.toLocaleString()} |
                            </span>
                        )}
                         持仓市值: ¥{portfolio.account.holdingsValue.toLocaleString()}
                        {portfolio.account.targetAmount && portfolio.account.targetAmount > 0 && (
                            <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                                计划投入: ¥{portfolio.account.targetAmount.toLocaleString()}
                            </span>
                        )}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-2xl font-bold">¥{portfolio.account.totalValue.toLocaleString()}</div>
                    </div>
                    <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openDepositDialog(portfolio.account)}
                    >
                        💰 转入现金
                    </Button>
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => openDeleteDialog(portfolio.account.id)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>资产 (代码)</TableHead>
                            <TableHead className="text-right">持仓/价格</TableHead>
                            <TableHead className="text-right">当前市值</TableHead>
                            <TableHead className="text-right">盈亏</TableHead>
                            <TableHead className="text-right">配置比例 (目标)</TableHead>
                            <TableHead className="text-right">目标偏离 (Drift)</TableHead>
                            <TableHead className="text-right">建议操作</TableHead>
                            <TableHead className="text-right">动作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {portfolio.positions.length === 0 ? (
                           <TableRow>
                               <TableCell colSpan={8} className="text-center text-muted-foreground h-24">
                                   暂无持仓，请点击“记一笔”添加交易
                               </TableCell>
                           </TableRow>
                        ) : (
                            portfolio.positions.map((pos) => (
                                <TableRow key={pos.assetId}>
                                    <TableCell>
                                        <div className="font-medium">{pos.name || pos.symbol}</div>
                                        <div className="text-xs text-muted-foreground">{pos.symbol}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div>{pos.shares} {portfolio.account.marketType === 'otc' ? '份' : '股'}</div>
                                        <div className="text-xs text-muted-foreground">@ {pos.price}</div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        ¥{pos.currentValue.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className={pos.profitLoss >= 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                                            ¥{pos.profitLoss?.toLocaleString() || 0}
                                        </div>
                                        <div className={`text-xs ${pos.profitLossPercent >= 0 ? "text-red-600" : "text-green-600"}`}>
                                            {pos.profitLossPercent >= 0 ? "+" : ""}{pos.profitLossPercent?.toFixed(2) || 0}%
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span>{pos.currentPercent}%</span>
                                            <span className="text-xs text-muted-foreground">/ {pos.targetPercent}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className={pos.driftValue < 0 ? "text-red-500 font-bold" : pos.driftValue > 0 ? "text-green-600" : "text-gray-400"}>
                                            {pos.driftValue.toLocaleString()}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {pos.actionShares !== 0 && (
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${pos.actionShares > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {pos.actionShares > 0 ? "买入" : "卖出"} {Math.abs(pos.actionShares)} {portfolio.account.marketType === 'otc' ? '份' : '股'}
                                            </span>
                                        )}
                                        {pos.actionShares === 0 && <span className="text-gray-400">-</span>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" 
                                                onClick={() => openSellDialog(portfolio.account.id, pos.symbol, pos.shares)}>
                                                <DollarSign className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="bg-muted/50 p-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openAllocationDialog(portfolio.account.id)}>
                    <TrendingUp className="mr-2 h-4 w-4"/> 配置
                </Button>
                <Button variant="outline" size="sm" onClick={() => openTxDialog(portfolio.account.id)}>
                    <Plus className="mr-2 h-4 w-4"/> 记一笔
                </Button>
                {portfolio.account.marketType === 'otc' && (
                    <Button variant="outline" size="sm" onClick={() => openManualHoldingDialog(portfolio.account)}>
                        记录份额
                    </Button>
                )}
            </CardFooter>
        </Card>
      ))}

      {/* 3. Global Dialogs */}
      
      {/* Transaction Dialog */}
      <Dialog open={isTxOpen} onOpenChange={setIsTxOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{newTx.type === 'buy' ? '买入资产' : '卖出资产'}</DialogTitle>
                <DialogDescription>
                    可从现有持仓选择，或输入新资产代码。价格留空通过接口获取。
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">类型</Label>
                     <Select value={newTx.type} onValueChange={v => setNewTx({...newTx, type: v})}>
                         <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                         <SelectContent>
                             <SelectItem value="buy">买入 (Buy)</SelectItem>
                             <SelectItem value="sell">卖出 (Sell)</SelectItem>
                         </SelectContent>
                     </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">账户</Label>
                    <Select value={newTx.accountId ? newTx.accountId.toString() : ''} onValueChange={v => setNewTx({...newTx, accountId: parseInt(v), symbol: ''})}>
                         <SelectTrigger className="col-span-3"><SelectValue placeholder="选择账户" /></SelectTrigger>
                         <SelectContent>
                             {portfolios.map(p => (
                                 <SelectItem key={p.account.id} value={p.account.id.toString()}>{p.account.name}</SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                </div>
                {/* 现有持仓选择 */}
                {newTx.accountId > 0 && (portfolios.find(p => p.account.id === newTx.accountId)?.positions.length || 0) > 0 && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">现有持仓</Label>
                        <Select 
                            value={newTx.symbol} 
                            onValueChange={v => setNewTx({...newTx, symbol: v})}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="选择持仓资产（可选）" />
                            </SelectTrigger>
                            <SelectContent>
                                {portfolios.find(p => p.account.id === newTx.accountId)?.positions.map(pos => {
                                    const isOTC = portfolios.find(p => p.account.id === newTx.accountId)?.account.marketType === 'otc';
                                    return (
                                        <SelectItem key={pos.symbol} value={pos.symbol}>
                                            {pos.name || pos.symbol} ({pos.symbol}) - 持有 {pos.shares} {isOTC ? '份' : '股'}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">代码 (Symbol)</Label>
                    <Input placeholder="sh600519 / 513100" 
                           value={newTx.symbol} 
                           onChange={e => setNewTx({...newTx, symbol: e.target.value})} 
                           className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">
                        数量 ({portfolios.find(p => p.account.id === newTx.accountId)?.account.marketType === 'otc' ? '份' : '股'})
                    </Label>
                    <Input type="number" 
                           value={newTx.shares} 
                           onChange={e => setNewTx({...newTx, shares: e.target.value})} 
                           className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">单价 (可选)</Label>
                    <Input type="number" 
                           placeholder={portfolios.find(p => p.account.id === newTx.accountId)?.account.marketType === 'otc' ? '场外账户需手动输入' : '留空自动获取'} 
                           value={newTx.price} 
                           onChange={e => setNewTx({...newTx, price: e.target.value})} 
                           className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">日期</Label>
                    <Input type="date"
                           value={newTx.date} 
                           onChange={e => setNewTx({...newTx, date: e.target.value})} 
                           className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleCreateTransaction}>提交交易</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>确认删除账户</DialogTitle>
                <DialogDescription>
                    此操作将永久删除该账户及其所有相关数据（包括交易记录、持仓和配置）。此操作不可撤销。
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <p className="text-red-600 font-medium">确定要删除这个账户吗？</p>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>取消</Button>
                <Button variant="destructive" onClick={handleDeleteAccount}>确认删除</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Allocation Dialog */}
      <Dialog open={isAllocationOpen} onOpenChange={setIsAllocationOpen}>
        <DialogContent className="sm:max-w-[380px] max-h-[80vh] overflow-y-auto">
            <DialogHeader className="pb-2">
                <DialogTitle className="text-lg">资产配置管理</DialogTitle>
                <DialogDescription className="text-xs">
                    设置账户的资产配置目标比例，总和不超过100%，剩余部分自动算为现金。
                </DialogDescription>
            </DialogHeader>
            
            {/* Allocation Summary */}
            <div className="grid gap-2 py-2 border-b">
                <div className="flex justify-between items-center">
                    <h3 className="font-medium text-sm">配置概览</h3>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground">已配置</div>
                            <div className="font-medium text-sm">
                                {allocations.reduce((sum, alloc) => sum + alloc.targetPercent, 0).toFixed(1)}%
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground">剩余现金</div>
                            <div className="font-medium text-sm">
                                {Math.max(0, 100 - allocations.reduce((sum, alloc) => sum + alloc.targetPercent, 0)).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Add New Allocation */}
            <div className="grid gap-3 py-3 border-b">
                <h3 className="font-medium text-sm">添加配置</h3>
                <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right text-xs">资产类型</Label>
                    <Select 
                        value={newAllocation.assetType} 
                        onValueChange={v => setNewAllocation({...newAllocation, assetType: v, assetId: '', newAssetName: '', newAssetSymbol: ''})}
                    >
                        <SelectTrigger className="col-span-3 h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="existing">现有资产</SelectItem>
                            <SelectItem value="new">新资产</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                {/* Existing Asset */}
                {newAllocation.assetType === 'existing' && (
                    <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right text-xs">选择资产</Label>
                        <div className="col-span-3 flex gap-2">
                            <Select 
                                value={newAllocation.assetId} 
                                onValueChange={v => setNewAllocation({...newAllocation, assetId: v})}
                            >
                                <SelectTrigger className="h-8 flex-1">
                                    <SelectValue placeholder="选择资产" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableAssets.map(asset => (
                                        <SelectItem key={asset.id} value={asset.id.toString()}>
                                            {asset.name || asset.symbol} ({asset.symbol})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {newAllocation.assetId && (
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                        const asset = availableAssets.find(a => a.id.toString() === newAllocation.assetId);
                                        if (asset) openEditAssetDialog(asset);
                                    }}
                                    className="h-8 w-8 p-0"
                                >
                                    ✏️
                                </Button>
                            )}
                        </div>
                    </div>
                )}
                
                {/* New Asset */}
                {newAllocation.assetType === 'new' && (
                    <>
                        <div className="grid grid-cols-4 items-center gap-3">
                            <Label className="text-right text-xs">资产代码</Label>
                            <div className="col-span-3 flex gap-2">
                                <Input 
                                    value={newAllocation.newAssetSymbol} 
                                    onChange={e => setNewAllocation({...newAllocation, newAssetSymbol: e.target.value})} 
                                    className="h-8 flex-1" 
                                    placeholder="例如: 00700 或 510300"
                                />
                                {newAllocation.newAssetSymbol && (
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={async () => {
                                            const res = await fetch(`/api/assets/lookup?symbol=${encodeURIComponent(newAllocation.newAssetSymbol)}`);
                                            const data = await res.json();
                                            if (data.name) {
                                                setNewAllocation({...newAllocation, newAssetName: data.name});
                                            } else {
                                                alert('无法获取该代码的官方名称，请手动输入');
                                            }
                                        }}
                                        className="h-8"
                                    >
                                        查询
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-3">
                            <Label className="text-right text-xs">资产名称</Label>
                            <Input 
                                value={newAllocation.newAssetName} 
                                onChange={e => setNewAllocation({...newAllocation, newAssetName: e.target.value})} 
                                className="col-span-3 h-8" 
                                placeholder="自动填充或手动输入"
                            />
                        </div>
                    </>
                )}
                
                <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right text-xs">目标比例 (%)</Label>
                    <Input 
                        type="number" 
                        step="0.1" 
                        min="0" 
                        max="100"
                        value={newAllocation.targetPercent} 
                        onChange={e => setNewAllocation({...newAllocation, targetPercent: e.target.value})} 
                        className="col-span-3 h-8" 
                        placeholder="例如: 20"
                    />
                </div>
                <Button onClick={handleAddAllocation} size="sm">添加配置</Button>
            </div>
            
            {/* Existing Allocations */}
            <div className="py-4">
                <h3 className="font-medium mb-4">现有配置</h3>
                {allocations.length === 0 ? (
                    <p className="text-muted-foreground">暂无配置，请添加配置</p>
                ) : (
                    <div className="space-y-4">
                        {allocations.map(allocation => (
                            <div key={allocation.id} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                                <div>
                                    <div className="font-medium">
                                        {allocation.asset.name || allocation.asset.symbol} ({allocation.asset.symbol})
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input 
                                        type="number" 
                                        step="0.1" 
                                        min="0" 
                                        max="100"
                                        value={allocation.targetPercent} 
                                        onChange={(e) => handleUpdateAllocation(
                                            allocation.id, 
                                            parseFloat(e.target.value)
                                        )} 
                                        className="w-24 text-center"
                                    />
                                    <span className="text-sm">%</span>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-8 w-8 p-0 text-red-500"
                                        onClick={() => handleDeleteAllocation(allocation.id)}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsAllocationOpen(false)}>关闭</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

            <Dialog open={isManualHoldingOpen} onOpenChange={setIsManualHoldingOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>记录当前份额（场外）</DialogTitle>
                        <DialogDescription>
                            适合场外账户按当前实际持有份额做快照；填 0 可清空该资产持仓。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="text-sm text-muted-foreground">
                            账户：{manualHoldingAccount?.name || '-'}
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">资产类型</Label>
                            <Select
                                value={manualHolding.assetType}
                                onValueChange={val => setManualHolding({ ...manualHolding, assetType: val, assetId: '', symbol: '', name: '' })}
                            >
                                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="existing">现有资产</SelectItem>
                                    <SelectItem value="new">新资产</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {manualHolding.assetType === 'existing' ? (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">资产</Label>
                                <Select value={manualHolding.assetId} onValueChange={val => setManualHolding({ ...manualHolding, assetId: val })}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="选择资产" /></SelectTrigger>
                                    <SelectContent>
                                        {availableAssets.map(asset => (
                                            <SelectItem key={asset.id} value={asset.id.toString()}>
                                                {asset.name || asset.symbol} ({asset.symbol})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">代码</Label>
                                    <Input
                                        className="col-span-3"
                                        value={manualHolding.symbol}
                                        onChange={e => setManualHolding({ ...manualHolding, symbol: e.target.value })}
                                        placeholder="例如: 017888"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">名称</Label>
                                    <Input
                                        className="col-span-3"
                                        value={manualHolding.name}
                                        onChange={e => setManualHolding({ ...manualHolding, name: e.target.value })}
                                        placeholder="可选，默认用代码"
                                    />
                                </div>
                            </>
                        )}

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">当前份额</Label>
                            <Input
                                type="number"
                                className="col-span-3"
                                value={manualHolding.shares}
                                onChange={e => setManualHolding({ ...manualHolding, shares: e.target.value })}
                                placeholder="例如: 1234.56"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">平均成本</Label>
                            <Input
                                type="number"
                                className="col-span-3"
                                value={manualHolding.avgCost}
                                onChange={e => setManualHolding({ ...manualHolding, avgCost: e.target.value })}
                                placeholder="可选"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">当前净值</Label>
                            <Input
                                type="number"
                                className="col-span-3"
                                value={manualHolding.currentPrice}
                                onChange={e => setManualHolding({ ...manualHolding, currentPrice: e.target.value })}
                                placeholder="可选，用于更新市值"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManualHoldingOpen(false)}>取消</Button>
                        <Button onClick={handleRecordManualHolding}>保存份额</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

    </div>
  );
}
