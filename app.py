import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from database import Database
from price_fetcher import PriceFetcher

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei']
plt.rcParams['axes.unicode_minus'] = False

class AssetTrackerApp:
    def __init__(self):
        self.db = Database()
        self.fetcher = PriceFetcher()
        self.setup_page()
    
    def setup_page(self):
        st.set_page_config(
            page_title="个人资产配置与净值追踪系统",
            page_icon="📊",
            layout="wide"
        )
        st.title("个人资产配置与净值追踪系统")
    
    def run(self):
        # 侧边栏导航
        with st.sidebar:
            st.header("导航")
            page = st.radio(
                "选择功能",
                ["数据看板", "资产管理", "配置目标", "关于"]
            )
        
        if page == "数据看板":
            self.show_dashboard()
        elif page == "资产管理":
            self.show_asset_management()
        elif page == "配置目标":
            self.show_targets()
        elif page == "关于":
            self.show_about()
    
    def show_dashboard(self):
        """显示数据看板 - 按资产配置逻辑重新组织"""
        st.header("数据看板")
        
        # 刷新价格按钮
        if st.button("刷新当前净值"):
            with st.spinner("正在刷新资产价格..."):
                updated_count = self.fetcher.refresh_all_prices(self.db)
                st.success(f"已更新 {updated_count} 个资产的价格")
        
        # 第一层：总体资产概况
        st.subheader("📊 总体资产概况")
        total_value = self.calculate_total_value()
        total_cost = self.calculate_total_cost()
        total_pnl = total_value - total_cost
        pnl_ratio = (total_pnl / total_cost * 100) if total_cost > 0 else 0
        
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("总资产市值", f"¥{total_value:,.2f}")
        col2.metric("总成本", f"¥{total_cost:,.2f}")
        col3.metric("总浮动盈亏", f"¥{total_pnl:,.2f}", f"{pnl_ratio:.2f}%")
        col4.metric("今日预估盈亏", f"¥{self.calculate_today_pnl():,.2f}")
        
        # 第二层：账户分布
        st.subheader("💰 账户分布")
        self.show_account_distribution()
        
        # 第三层：资产配置对比
        st.subheader("📈 资产配置对比")
        self.plot_asset_allocation()
    
    def calculate_total_value(self):
        """计算总资产市值"""
        assets = self.db.get_assets()
        total = 0
        for asset in assets:
            asset_id, account_id, name, code, asset_type, shares, cost_price, current_price, last_updated = asset
            if current_price > 0:
                total += shares * current_price
            else:
                total += shares * cost_price
        return total
    
    def calculate_total_cost(self):
        """计算总成本"""
        assets = self.db.get_assets()
        total_cost = 0
        for asset in assets:
            asset_id, account_id, name, code, asset_type, shares, cost_price, current_price, last_updated = asset
            total_cost += shares * cost_price
        return total_cost
    
    def calculate_total_pnl(self):
        """计算总浮动盈亏"""
        assets = self.db.get_assets()
        total_pnl = 0
        for asset in assets:
            asset_id, account_id, name, code, asset_type, shares, cost_price, current_price, last_updated = asset
            if current_price > 0:
                pnl = shares * (current_price - cost_price)
                total_pnl += pnl
        return total_pnl
    
    def calculate_today_pnl(self):
        """计算今日预估盈亏（简化处理）"""
        # 这里简化处理，实际应根据昨日收盘价计算
        return 0
    
    def show_account_distribution(self):
        """显示账户分布"""
        accounts = self.db.get_accounts()
        account_data = []
        
        for account in accounts:
            account_id, account_name, description = account
            assets = self.db.get_assets(account_id)
            
            account_value = 0
            account_cost = 0
            for asset in assets:
                asset_id, acc_id, name, code, asset_type, shares, cost_price, current_price, last_updated = asset
                if current_price > 0:
                    account_value += shares * current_price
                else:
                    account_value += shares * cost_price
                account_cost += shares * cost_price
            
            account_pnl = account_value - account_cost
            pnl_ratio = (account_pnl / account_cost * 100) if account_cost > 0 else 0
            
            account_data.append({
                "账户名称": account_name,
                "市值": f"¥{account_value:,.2f}",
                "成本": f"¥{account_cost:,.2f}",
                "盈亏": f"¥{account_pnl:,.2f}",
                "盈亏比例": f"{pnl_ratio:.2f}%",
                "占比": 0  # 稍后计算
            })
        
        # 计算占比
        total_value = sum([float(a["市值"].replace("¥", "").replace(",", "")) for a in account_data])
        for item in account_data:
            value = float(item["市值"].replace("¥", "").replace(",", ""))
            item["占比"] = f"{(value / total_value * 100):.1f}%" if total_value > 0 else "0.0%"
        
        # 显示账户分布表格
        if account_data:
            df = pd.DataFrame(account_data)
            st.dataframe(df, use_container_width=True)
            
            # 显示账户分布饼图
            fig, ax = plt.subplots(figsize=(8, 6))
            labels = [a["账户名称"] for a in account_data]
            values = [float(a["市值"].replace("¥", "").replace(",", "")) for a in account_data]
            colors = plt.cm.Set3(np.linspace(0, 1, len(labels)))
            
            ax.pie(values, labels=labels, autopct='%1.1f%%', startangle=90, colors=colors)
            ax.set_title('账户资产分布')
            ax.axis('equal')
            
            st.pyplot(fig)
        else:
            st.info("暂无账户数据")
    
    def plot_asset_allocation(self):
        """绘制资产配置对比图表 - 按账户分别展示"""
        accounts = self.db.get_accounts()
        
        if not accounts:
            st.warning("暂无账户数据")
            return
        
        # 为每个账户展示资产配置
        for account in accounts:
            account_id, account_name, description = account
            assets = self.db.get_assets(account_id)
            targets = self.db.get_targets(account_id)
            
            if not assets and not targets:
                continue
            
            st.write(f"**{account_name}**")
            
            # 按资产类型分组计算当前市值
            asset_type_values = {}
            for asset in assets:
                asset_id, acc_id, name, code, asset_type, shares, cost_price, current_price, last_updated = asset
                if current_price > 0:
                    value = shares * current_price
                else:
                    value = shares * cost_price
                
                if asset_type not in asset_type_values:
                    asset_type_values[asset_type] = 0
                asset_type_values[asset_type] += value
            
            # 获取配置目标
            target_dict = {}
            for target in targets:
                target_id, acc_id, asset_type, target_percentage = target
                target_dict[asset_type] = target_percentage
            
            # 准备数据
            labels = list(set(list(asset_type_values.keys()) + list(target_dict.keys())))
            actual_values = [asset_type_values.get(label, 0) for label in labels]
            target_values = [target_dict.get(label, 0) for label in labels]
            
            # 计算百分比
            total_actual = sum(actual_values)
            if total_actual > 0:
                actual_percentages = [v / total_actual * 100 for v in actual_values]
            else:
                actual_percentages = [0] * len(labels)
            
            total_target = sum(target_values)
            if total_target > 0:
                target_percentages = [v / total_target * 100 for v in target_values]
            else:
                target_percentages = [0] * len(labels)
            
            # 创建双环饼图
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
            
            # 实际配置
            if sum(actual_percentages) > 0:
                ax1.pie(actual_percentages, labels=labels, autopct='%1.1f%%', startangle=90)
                ax1.set_title(f'{account_name} - 当前实际配置')
                ax1.axis('equal')
            else:
                ax1.text(0.5, 0.5, '暂无实际配置数据', ha='center', va='center')
                ax1.set_title(f'{account_name} - 当前实际配置')
            
            # 目标配置
            if sum(target_percentages) > 0:
                ax2.pie(target_percentages, labels=labels, autopct='%1.1f%%', startangle=90)
                ax2.set_title(f'{account_name} - 目标配置')
                ax2.axis('equal')
            else:
                ax2.text(0.5, 0.5, '暂无目标配置数据', ha='center', va='center')
                ax2.set_title(f'{account_name} - 目标配置')
            
            st.pyplot(fig)
            
            # 显示偏差表格
            deviation_data = []
            for i, label in enumerate(labels):
                deviation = actual_percentages[i] - target_percentages[i]
                deviation_data.append({
                    "资产类型": label,
                    "目标比例": f"{target_percentages[i]:.1f}%",
                    "实际比例": f"{actual_percentages[i]:.1f}%",
                    "偏差": f"{deviation:+.1f}%"
                })
            
            if deviation_data:
                st.dataframe(pd.DataFrame(deviation_data), use_container_width=True)
            
            st.divider()
    
    def show_asset_management(self):
        """显示资产管理界面"""
        st.header("资产管理")
        
        # 选择账户
        accounts = self.db.get_accounts()
        account_options = {account[1]: account[0] for account in accounts}
        selected_account = st.selectbox("选择账户", list(account_options.keys()))
        account_id = account_options[selected_account]
        
        # 显示资产列表
        st.subheader(f"{selected_account} - 资产列表")
        assets = self.db.get_assets(account_id)
        
        if assets:
            asset_data = []
            for asset in assets:
                asset_id, acc_id, name, code, asset_type, shares, cost_price, current_price, last_updated = asset
                if current_price > 0:
                    current_value = shares * current_price
                    pnl = current_value - (shares * cost_price)
                    pnl_ratio = (current_price - cost_price) / cost_price * 100
                else:
                    current_value = shares * cost_price
                    pnl = 0
                    pnl_ratio = 0
                
                asset_data.append({
                    "ID": asset_id,
                    "名称": name,
                    "代码": code,
                    "类型": asset_type,
                    "份额": shares,
                    "成本价": cost_price,
                    "当前价": current_price,
                    "市值": current_value,
                    "盈亏": pnl,
                    "盈亏比例": f"{pnl_ratio:.2f}%",
                    "最后更新": last_updated
                })
            
            df = pd.DataFrame(asset_data)
            st.dataframe(df)
            
            # 删除资产
            delete_id = st.number_input("输入要删除的资产ID", min_value=1, step=1)
            if st.button("删除资产"):
                result = self.db.delete_asset(delete_id)
                if result > 0:
                    st.success("资产删除成功")
                    st.experimental_rerun()
                else:
                    st.error("资产删除失败")
        else:
            st.info("该账户暂无资产")
        
        # 添加资产
        st.subheader("添加资产")
        with st.form("add_asset_form"):
            asset_name = st.text_input("资产名称")
            asset_code = st.text_input("资产代码")
            asset_type = st.selectbox("资产类型", ["etf", "fund", "stock"])
            shares = st.number_input("买入份额", min_value=0.01, step=0.01)
            cost_price = st.number_input("成本价格", min_value=0.01, step=0.01)
            
            if st.form_submit_button("添加资产"):
                if asset_name and asset_code:
                    asset_id = self.db.add_asset(account_id, asset_name, asset_code, asset_type, shares, cost_price)
                    if asset_id:
                        st.success("资产添加成功")
                        st.experimental_rerun()
                    else:
                        st.error("资产添加失败")
                else:
                    st.error("请填写资产名称和代码")
    
    def show_targets(self):
        """显示配置目标界面"""
        st.header("配置目标管理")
        
        # 选择账户
        accounts = self.db.get_accounts()
        account_options = {account[1]: account[0] for account in accounts}
        selected_account = st.selectbox("选择账户", list(account_options.keys()))
        account_id = account_options[selected_account]
        
        # 显示当前目标
        st.subheader(f"{selected_account} - 当前配置目标")
        targets = self.db.get_targets(account_id)
        
        if targets:
            target_data = []
            total_percentage = 0
            for target in targets:
                target_id, acc_id, asset_type, target_percentage = target
                total_percentage += target_percentage
                target_data.append({
                    "ID": target_id,
                    "资产类型": asset_type,
                    "目标比例": f"{target_percentage:.1f}%"
                })
            
            st.dataframe(pd.DataFrame(target_data))
            st.write(f"当前总比例: {total_percentage:.1f}%")
            
            # 调整比例功能
            st.subheader("调整配置比例")
            with st.form("adjust_target_form"):
                adjust_asset_type = st.selectbox("选择资产类型", [t[2] for t in targets])
                new_percentage = st.number_input("新比例 (%)", min_value=0.1, max_value=100.0, step=0.1)
                
                if st.form_submit_button("调整比例"):
                    # 计算需要调整的金额
                    adjust_amount = new_percentage
                    for target in targets:
                        if target[2] == adjust_asset_type:
                            adjust_amount -= target[3]
                            break
                    
                    # 分配调整金额到其他资产
                    other_targets = [t for t in targets if t[2] != adjust_asset_type]
                    if other_targets:
                        adjust_per_target = adjust_amount / len(other_targets)
                        for target in other_targets:
                            new_target_percentage = max(0.1, target[3] - adjust_per_target)
                            self.db.update_target(target[0], new_target_percentage)
                    
                    # 更新选中资产的比例
                    for target in targets:
                        if target[2] == adjust_asset_type:
                            self.db.update_target(target[0], new_percentage)
                            break
                    
                    st.success("配置比例调整成功")
                    st.experimental_rerun()
        else:
            st.info("该账户暂无配置目标")
        
        # 添加新目标
        st.subheader("添加新配置目标")
        with st.form("add_target_form"):
            asset_type = st.text_input("资产类型")
            target_percentage = st.number_input("目标比例 (%)", min_value=0.1, max_value=100.0, step=0.1)
            
            if st.form_submit_button("添加目标"):
                if asset_type:
                    # 获取现有目标
                    existing_targets = self.db.get_targets(account_id)
                    total_existing = sum(t[3] for t in existing_targets)
                    
                    # 计算需要从其他资产中减少的比例
                    if total_existing > 0:
                        available_percentage = 100 - total_existing
                        if target_percentage > available_percentage:
                            st.error(f"添加新目标后总比例不能超过100%，当前可用比例: {available_percentage:.1f}%")
                        else:
                            # 按比例从现有资产中减少
                            for target in existing_targets:
                                reduce_amount = (target[3] / total_existing) * target_percentage
                                new_percentage = max(0.1, target[3] - reduce_amount)
                                self.db.update_target(target[0], new_percentage)
                            
                            # 添加新目标
                            result = self.db.add_target(account_id, asset_type, target_percentage)
                            if result:
                                st.success("新配置目标添加成功")
                                st.experimental_rerun()
                            else:
                                st.error("配置目标添加失败")
                    else:
                        # 首次添加目标
                        result = self.db.add_target(account_id, asset_type, target_percentage)
                        if result:
                            st.success("新配置目标添加成功")
                            st.experimental_rerun()
                        else:
                            st.error("配置目标添加失败")
                else:
                    st.error("请填写资产类型")
    
    def show_about(self):
        """显示关于页面"""
        st.header("关于系统")
        st.markdown("""
        **个人资产配置与净值追踪系统**
        
        本系统用于帮助用户管理个人资产配置，包括：
        
        - 记录不同账户（长钱、稳钱、卫星仓、短线）的资产
        - 设定各项资产的目标配置比例
        - 记录实际买入的份额和成本
        - 通过调用公开的财经API自动刷新当前净值
        - 对比"计划配置"与"实际持仓"的偏差
        
        **核心功能**：
        - 数据看板：展示总资产市值、浮动盈亏和资产配置对比
        - 资产管理：支持添加、编辑、删除资产记录
        - 配置目标：设置各资产类型的目标配置比例
        
        **技术栈**：
        - Python
        - Streamlit (Web界面)
        - SQLite (数据库)
        - AkShare (财经数据API)
        - Matplotlib (图表)
        """)

if __name__ == "__main__":
    app = AssetTrackerApp()
    app.run()
