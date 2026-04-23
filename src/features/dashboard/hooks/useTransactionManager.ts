import { useMemo, useState } from 'react';
import type { Transaction } from '@/features/dashboard/types';

interface NewTransactionForm {
    accountId: number;
    type: 'buy' | 'sell';
    symbol: string;
    shares: string;
    price: string;
    date: string;
    syncCash: boolean;
}

interface UseTransactionManagerOptions {
    fetchAllPortfolios: (showLoading?: boolean) => Promise<void>;
}

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

const INITIAL_TX_FORM: NewTransactionForm = {
    accountId: 0,
    type: 'buy',
    symbol: '',
    shares: '0',
    price: '',
    date: getTodayDateString(),
    syncCash: true,
};

export function useTransactionManager({
    fetchAllPortfolios,
}: UseTransactionManagerOptions) {
    const [isTxOpen, setIsTxOpen] = useState(false);
    const [submittingTx, setSubmittingTx] = useState(false);
    const [newTx, setNewTx] = useState<NewTransactionForm>(INITIAL_TX_FORM);

    const [isTransactionHistoryOpen, setIsTransactionHistoryOpen] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [selectedAccountForHistory, setSelectedAccountForHistory] = useState<number | null>(null);
    const [transactionFilterSymbol, setTransactionFilterSymbol] = useState('');

    const resetTxForm = () => {
        setNewTx({ ...INITIAL_TX_FORM, date: getTodayDateString() });
    };

    const openBuyDialog = (accountId: number) => {
        setNewTx((prev) => ({
            ...prev,
            accountId,
            type: 'buy',
            symbol: '',
            price: '',
            syncCash: true,
            date: prev.date || getTodayDateString(),
        }));
        setIsTxOpen(true);
    };

    const openSellDialog = (accountId: number, symbol: string, currentShares: number) => {
        setNewTx((prev) => ({
            ...prev,
            accountId,
            type: 'sell',
            symbol,
            shares: currentShares.toString(),
            price: '',
            syncCash: true,
            date: prev.date || getTodayDateString(),
        }));
        setIsTxOpen(true);
    };

    const handleCreateTransaction = async () => {
        if (submittingTx) return;
        if (!newTx.accountId) return alert('请选择账户');
        if (!newTx.symbol && !newTx.price) return alert('请输入代码');

        setSubmittingTx(true);
        try {
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
                resetTxForm();
                await fetchAllPortfolios();
            } else {
                const err = await res.json();
                alert(err.error || '交易创建失败');
            }
        } finally {
            setSubmittingTx(false);
        }
    };

    const fetchTransactions = async (accountId?: number) => {
        setLoadingTransactions(true);
        try {
            const url = accountId ? `/api/transactions?accountId=${accountId}` : '/api/transactions';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            } else {
                setTransactions([]);
            }
        } catch (error) {
            console.error('Failed to fetch transactions', error);
            setTransactions([]);
        } finally {
            setLoadingTransactions(false);
        }
    };

    const openTransactionHistory = async (accountId: number) => {
        setSelectedAccountForHistory(accountId);
        setTransactionFilterSymbol('');
        await fetchTransactions(accountId);
        setIsTransactionHistoryOpen(true);
    };

    const handleDeleteTransaction = async (transactionId: number) => {
        if (!confirm('确定要删除这条交易记录吗？删除后会自动同步更新持仓和现金余额。')) {
            return;
        }

        try {
            const res = await fetch(`/api/transactions/${transactionId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                await fetchTransactions(selectedAccountForHistory || undefined);
                await fetchAllPortfolios();
                alert('交易记录已删除，持仓和现金已同步更新');
            } else {
                const err = await res.json();
                alert(err.error || '删除失败');
            }
        } catch (error) {
            console.error('Failed to delete transaction', error);
            alert('删除失败');
        }
    };

    const filteredTransactions = useMemo(() => {
        if (!transactionFilterSymbol) return transactions;
        const keyword = transactionFilterSymbol.toLowerCase();
        return transactions.filter((tx) =>
            tx.asset?.symbol?.toLowerCase().includes(keyword) ||
            tx.asset?.name?.toLowerCase().includes(keyword)
        );
    }, [transactionFilterSymbol, transactions]);

    return {
        isTxOpen,
        setIsTxOpen,
        submittingTx,
        newTx,
        setNewTx,
        openBuyDialog,
        openSellDialog,
        handleCreateTransaction,
        isTransactionHistoryOpen,
        setIsTransactionHistoryOpen,
        loadingTransactions,
        transactionFilterSymbol,
        setTransactionFilterSymbol,
        openTransactionHistory,
        handleDeleteTransaction,
        filteredTransactions,
    };
}
