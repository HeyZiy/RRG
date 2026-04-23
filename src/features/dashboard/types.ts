export interface PortfolioPosition {
    assetId: number;
    symbol: string;
    name: string;
    shares: number;
    avgCost?: number;
    price: number;
    currentValue: number;
    cost?: number;
    profitLoss?: number;
    profitLossPercent?: number;
    currentPercent: number;
    targetPercent: number;
    targetValue: number;
    driftValue: number;
    actionShares: number;
    actionAmount: number;
    isOTC?: boolean;
}

export interface PortfolioAccount {
    id: number;
    name: string;
    platform?: string;
    marketType: string;
    cash: number;
    totalValue: number;
    holdingsValue: number;
    targetAmount?: number;
}

export interface PortfolioResponse {
    account: PortfolioAccount;
    positions: PortfolioPosition[];
}

export interface Transaction {
    id: number;
    accountId: number;
    assetId: number;
    type: 'buy' | 'sell';
    amount: number;
    price: number;
    shares: number;
    date: string;
    syncCash: boolean;
    createdAt: string;
    asset: {
        id: number;
        symbol: string;
        name: string;
    };
    account: {
        id: number;
        name: string;
    };
}

export interface AllocationItem {
    id: number;
    accountId: number;
    assetId: number;
    targetPercent: number;
    asset: {
        id: number;
        symbol: string;
        name: string;
    };
}

export interface SummaryAsset {
    assetId: number;
    symbol: string;
    name: string;
    accountId: number;
    accountName: string;
    shares: number;
    price: number;
    value: number;
}

export interface SummaryCategory {
    category: string;
    currentValue: number;
    targetAmount: number;
    targetId: number | null;
    note: string | null;
    diff: number;
    assets: SummaryAsset[];
}

export interface SummaryResponse {
    totalValue: number;
    categories: SummaryCategory[];
    uncategorized: {
        currentValue: number;
        assets: SummaryAsset[];
    };
}

export interface AssetItem {
    id: number;
    symbol: string;
    name: string;
    type: string;
    currentPrice: number | null;
    category: string | null;
}
