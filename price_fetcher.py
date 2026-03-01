import akshare as ak
import pandas as pd
from datetime import datetime

class PriceFetcher:
    def __init__(self):
        pass
    
    def fetch_price(self, code, asset_type):
        """
        根据资产类型和代码获取最新价格
        :param code: 资产代码
        :param asset_type: 资产类型 (etf, fund, stock)
        :return: 最新价格，如获取失败返回None
        """
        try:
            if asset_type == 'etf':
                return self._fetch_etf_price(code)
            elif asset_type == 'fund':
                return self._fetch_fund_price(code)
            elif asset_type == 'stock':
                return self._fetch_stock_price(code)
            else:
                print(f"不支持的资产类型: {asset_type}")
                return None
        except Exception as e:
            print(f"获取价格失败: {e}")
            return None
    
    def _fetch_etf_price(self, code):
        """获取ETF价格"""
        try:
            # 使用akshare获取ETF实时行情
            df = ak.fund_etf_hist_em(symbol=code, period="daily", adjust="qfq")
            if not df.empty:
                # 获取最新价格
                latest_price = df.iloc[-1]['收盘']
                return float(latest_price)
            return None
        except Exception as e:
            print(f"获取ETF价格失败: {e}")
            return None
    
    def _fetch_fund_price(self, code):
        """获取基金价格"""
        try:
            # 使用akshare获取基金净值
            df = ak.fund_open_fund_info_em(fund=code, indicator="单位净值")
            if not df.empty:
                # 获取最新净值
                latest_nav = df.iloc[-1]['单位净值']
                return float(latest_nav)
            return None
        except Exception as e:
            print(f"获取基金价格失败: {e}")
            return None
    
    def _fetch_stock_price(self, code):
        """获取股票价格"""
        try:
            # 使用akshare获取股票实时行情
            df = ak.stock_zh_a_spot_em()
            stock_data = df[df['代码'] == code]
            if not stock_data.empty:
                latest_price = stock_data.iloc[0]['最新价']
                return float(latest_price)
            return None
        except Exception as e:
            print(f"获取股票价格失败: {e}")
            return None
    
    def refresh_all_prices(self, db):
        """
        刷新所有资产的价格
        :param db: Database实例
        :return: 更新成功的资产数量
        """
        updated_count = 0
        assets = db.get_assets()
        
        for asset in assets:
            asset_id, account_id, name, code, asset_type, shares, cost_price, current_price, last_updated = asset
            
            # 获取最新价格
            new_price = self.fetch_price(code, asset_type)
            if new_price:
                # 更新数据库
                db.update_asset(asset_id, 
                               current_price=new_price, 
                               last_updated=datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
                updated_count += 1
                print(f"更新 {name} ({code}) 价格: {new_price}")
        
        return updated_count
