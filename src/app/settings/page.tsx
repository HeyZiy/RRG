'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, FolderOpen, RefreshCcw } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
    const [dbPath, setDbPath] = useState<string>('');
    const [originalPath, setOriginalPath] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [envUrl, setEnvUrl] = useState('');

    useEffect(() => {
        // Only run in Electron
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            (window as any).electronAPI.getSettings().then((settings: any) => {
                if (settings && settings.dbPath) {
                    setDbPath(settings.dbPath);
                    setOriginalPath(settings.dbPath);
                }
            });
            (window as any).electronAPI.getDbUrl().then((url: string) => {
                setEnvUrl(url);
            });
        }
    }, []);

    const handleSelectPath = async () => {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            const newPath = await (window as any).electronAPI.selectDbPath(dbPath);
            if (newPath) {
                setDbPath(newPath);
                setSaved(false);
            }
        } else {
            alert('该功能仅在桌面客户端中可用');
        }
    };

    const handleSave = async () => {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            setLoading(true);
            try {
                await (window as any).electronAPI.saveSettings({ dbPath });
                setOriginalPath(dbPath);
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } catch (err) {
                console.error(err);
                alert('保存失败');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleRelaunch = () => {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            (window as any).electronAPI.relaunchApp();
        }
    };

    const needsRestart = dbPath === originalPath && dbPath !== '' && envUrl && !envUrl.includes(dbPath);

    return (
        <div className="container mx-auto p-6 max-w-3xl space-y-8">
            <div className="flex items-center space-x-4">
                <Link href="/" passHref>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">系统设置</h1>
                    <p className="text-muted-foreground">管理应用偏好和数据位置</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>数据存储</CardTitle>
                    <CardDescription>配置本地 SQLite 数据库的文件保存位置</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="dbPath">数据库文件路径</Label>
                        <div className="flex space-x-2">
                            <Input
                                id="dbPath"
                                value={dbPath}
                                readOnly
                                placeholder="未设置 (将使用默认位置)"
                                className="bg-muted"
                            />
                            <Button onClick={handleSelectPath} variant="secondary">
                                <FolderOpen className="mr-2 h-4 w-4" /> 选择目录
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            如果您选择了新的保存位置，请确保文件具有读写权限。注意：更改位置后不会自动复制旧数据。当前环境中实际引用的 URL 为: <code className="bg-gray-100 px-1 rounded">{envUrl || '默认'}</code>
                        </p>
                    </div>

                    {needsRestart && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md text-sm">
                            <p className="font-semibold mb-1">注意：需要重启应用</p>
                            <p>您已更改设置。为了使新的数据库路径生效，您必须重启应用程序。</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between border-t bg-muted/50 px-6 py-4">
                    {needsRestart ? (
                        <Button variant="destructive" onClick={handleRelaunch}>
                            <RefreshCcw className="mr-2 h-4 w-4" /> 立即重启应用
                        </Button>
                    ) : (
                        <div />
                    )}
                    <Button disabled={dbPath === originalPath || loading} onClick={handleSave}>
                        {loading && <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />}
                        {!loading && <Save className="mr-2 h-4 w-4" />}
                        {saved ? '已保存' : '保存设置'} 
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>资产管理</CardTitle>
                    <CardDescription>批量更新资产信息</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>更新所有资产名称</Label>
                        <p className="text-sm text-muted-foreground">
                            从东方财富自动获取并更新所有资产的官方名称，确保资产信息的准确性。
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="border-t bg-muted/50 px-6 py-4">
                    <Button onClick={async () => {
                        setLoading(true);
                        try {
                            const res = await fetch('/api/assets/sync', { method: 'POST' });
                            const data = await res.json();
                            if (res.ok) {
                                alert(`更新完成：\n` +
                                    `总资产数：${data.total}\n` +
                                    `更新名称：${data.updatedNameCount}\n` +
                                    `更新价格：${data.updatedPriceCount}\n` +
                                    `未变化：${data.unchangedCount}\n` +
                                    `失败：${data.failedCount}`);
                            } else {
                                alert('更新失败：' + (data.error || '未知错误'));
                            }
                        } catch (error) {
                            console.error('更新资产名称失败', error);
                            alert('更新失败，请稍后重试');
                        } finally {
                            setLoading(false);
                        }
                    }} disabled={loading}>
                        {loading && <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />}
                        {!loading && <RefreshCcw className="mr-2 h-4 w-4" />}
                        {loading ? '更新中...' : '更新所有资产名称'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
