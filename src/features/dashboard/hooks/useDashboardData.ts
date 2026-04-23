import { useEffect, useState } from 'react';
import type { AssetItem, PortfolioResponse, SummaryResponse } from '@/features/dashboard/types';

interface AccountLite {
    id: number;
}

export function useDashboardData() {
    const [portfolios, setPortfolios] = useState<PortfolioResponse[]>([]);
    const [availableAssets, setAvailableAssets] = useState<AssetItem[]>([]);
    const [summary, setSummary] = useState<SummaryResponse | null>(null);

    const [loading, setLoading] = useState(false);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [refreshingPrices, setRefreshingPrices] = useState(false);

    const fetchAllPortfolios = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
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

            const promises = (accounts as AccountLite[]).map((acc) =>
                fetch(`/api/portfolio?accountId=${acc.id}`).then(r => r.json())
            );

            const portfolioData = await Promise.all(promises);
            setPortfolios(portfolioData.filter(p => !p.error));
        } catch (error) {
            console.error('Failed to load data', error);
            setPortfolios([]);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const fetchAvailableAssets = async () => {
        try {
            const res = await fetch('/api/assets');
            const data = await res.json();
            setAvailableAssets(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch assets', error);
            setAvailableAssets([]);
        }
    };

    const fetchSummary = async () => {
        setSummaryLoading(true);
        try {
            const res = await fetch('/api/summary');
            if (res.ok) {
                const data = await res.json();
                setSummary(data);
            }
        } catch (error) {
            console.error('Failed to fetch summary', error);
        } finally {
            setSummaryLoading(false);
        }
    };

    const handleRefreshPrices = async () => {
        setRefreshingPrices(true);
        try {
            await fetch('/api/prices/refresh', { method: 'POST' });
            await fetchAllPortfolios();
            await fetchSummary();
        } catch {
            alert('行情更新失败');
        } finally {
            setRefreshingPrices(false);
        }
    };

    useEffect(() => {
        fetchAllPortfolios();
        fetchAvailableAssets();
        fetchSummary();
    }, []);

    return {
        portfolios,
        availableAssets,
        summary,
        loading,
        summaryLoading,
        refreshingPrices,
        fetchAllPortfolios,
        fetchAvailableAssets,
        fetchSummary,
        handleRefreshPrices,
    };
}
