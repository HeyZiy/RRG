import { useState } from 'react';
import type { AllocationItem } from '@/features/dashboard/types';

interface NewAllocationForm {
    assetType: 'existing' | 'new';
    assetId: string;
    targetPercent: string;
    newAssetName: string;
    newAssetSymbol: string;
}

interface UseAllocationManagerOptions {
    fetchAllPortfolios: (showLoading?: boolean) => Promise<void>;
    fetchAvailableAssets: () => Promise<void>;
}

export function useAllocationManager({
    fetchAllPortfolios,
    fetchAvailableAssets,
}: UseAllocationManagerOptions) {
    const [allocations, setAllocations] = useState<AllocationItem[]>([]);
    const [accountForAllocation, setAccountForAllocation] = useState<number | null>(null);
    const [isAllocationOpen, setIsAllocationOpen] = useState(false);
    const [newAllocation, setNewAllocation] = useState<NewAllocationForm>({
        assetType: 'existing',
        assetId: '',
        targetPercent: '',
        newAssetName: '',
        newAssetSymbol: '',
    });

    const normalizeAllocations = (data: unknown): AllocationItem[] => {
        if (!Array.isArray(data)) {
            return [];
        }

        const map = new Map<number, AllocationItem>();
        data.forEach((item) => {
            const row = item as AllocationItem;
            if (typeof row?.assetId !== 'number') {
                return;
            }
            if (!map.has(row.assetId)) {
                map.set(row.assetId, row);
            }
        });

        return Array.from(map.values());
    };

    const fetchAllocations = async (accountId: number) => {
        try {
            const res = await fetch(`/api/allocations?accountId=${accountId}`);
            const data = await res.json();
            setAllocations(normalizeAllocations(data));
        } catch (error) {
            console.error('Failed to fetch allocations', error);
            setAllocations([]);
        }
    };

    const handleUpsertAllocationTarget = async (accountId: number, assetId: number, targetPercent: number) => {
        const currentTotal = allocations.reduce((sum, alloc) => {
            if (alloc.accountId !== accountId || alloc.assetId === assetId) {
                return sum;
            }
            return sum + alloc.targetPercent;
        }, 0);

        if (currentTotal + targetPercent > 100) {
            alert('配置比例总和不能超过100%');
            return false;
        }

        const res = await fetch('/api/allocations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accountId,
                assetId,
                targetPercent,
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error || '保存配置失败');
            return false;
        }

        if (accountForAllocation === accountId) {
            await fetchAllocations(accountId);
        }
        await fetchAllPortfolios(false);
        return true;
    };

    const handleAddAllocation = async () => {
        if (!accountForAllocation || !newAllocation.targetPercent) {
            return alert('请填写完整的配置信息');
        }

        const newPercent = parseFloat(newAllocation.targetPercent);
        if (Number.isNaN(newPercent) || newPercent < 0 || newPercent > 100) {
            return alert('目标比例必须在 0 到 100 之间');
        }

        let assetId: number;

        if (newAllocation.assetType === 'new') {
            if (!newAllocation.newAssetName || !newAllocation.newAssetSymbol) {
                return alert('请填写新资产的名称和代码');
            }

            const assetRes = await fetch('/api/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newAllocation.newAssetName,
                    symbol: newAllocation.newAssetSymbol,
                    type: 'stock',
                    currentPrice: 0,
                }),
            });

            if (!assetRes.ok) {
                const err = await assetRes.json();
                return alert(err.error || '创建新资产失败');
            }

            const newAsset = await assetRes.json();
            assetId = newAsset.id;
        } else {
            if (!newAllocation.assetId) {
                return alert('请选择资产');
            }
            assetId = Number.parseInt(newAllocation.assetId, 10);
        }

        const saved = await handleUpsertAllocationTarget(accountForAllocation, assetId, newPercent);

        if (saved) {
            setNewAllocation({
                assetType: 'existing',
                assetId: '',
                targetPercent: '',
                newAssetName: '',
                newAssetSymbol: '',
            });
            await fetchAvailableAssets();
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
            if (accountForAllocation !== null) {
                await fetchAllocations(accountForAllocation);
            }
            await fetchAllPortfolios(false);
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
                if (accountForAllocation !== null) {
                    await fetchAllocations(accountForAllocation);
                }
                await fetchAllPortfolios(false);
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
            fetchAvailableAssets(),
        ]);
        setIsAllocationOpen(true);
    };

    return {
        allocations,
        isAllocationOpen,
        setIsAllocationOpen,
        accountForAllocation,
        newAllocation,
        setNewAllocation,
        fetchAllocations,
        handleAddAllocation,
        handleUpdateAllocation,
        handleDeleteAllocation,
        handleUpsertAllocationTarget,
        openAllocationDialog,
        setAccountForAllocation,
    };
}
