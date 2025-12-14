import akshare as ak
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import zscore
import os


plt.rcParams['font.sans-serif'] = ['SimHei']  # 用来正常显示中文标签
plt.rcParams['axes.unicode_minus'] = False  # 用来正常显示负号

# ======================
# 参数区
# ======================
LOOKBACK_RS = 20
LOOKBACK_MOM = 10
TRAIL_DAYS = 20

# ======================
# ETF 数据
# ======================
def get_etf(symbol):
    # 确保 data 目录存在
    if not os.path.exists("data"):
        os.makedirs("data")
        
    file_path = os.path.join("data", f"{symbol}.csv")
    
    if os.path.exists(file_path):
        print(f"Loading {symbol} from local cache...")
        df = pd.read_csv(file_path)
    else:
        print(f"Downloading {symbol}...")
        df = ak.fund_etf_hist_em(symbol=symbol, period="daily", adjust="qfq")
        df.to_csv(file_path, index=False)

    df["date"] = pd.to_datetime(df["日期"])
    df = df.set_index("date")
    return df["收盘"].astype(float)

# ======================
# RRG 指标
# ======================
def compute_rrg(price, benchmark):
    rs = price / benchmark
    rs_smooth = rs.rolling(LOOKBACK_RS).mean()
    rs_dropped = rs_smooth.dropna()
    rs_norm = pd.Series(zscore(rs_dropped), index=rs_dropped.index)

    mom = rs_norm - rs_norm.shift(LOOKBACK_MOM)
    mom = mom.dropna()

    df = pd.DataFrame({
        "RS": rs_norm.loc[mom.index],
        "MOM": mom
    })
    return df

# ======================
# ETF 组合
# ======================
benchmark = get_etf("510300")  # 沪深300 ETF

targets = {
    "消费": "159928",
    "医药": "512010",
    # "新能源": "516160",
    # "科技": "515000"
}

# ======================
# 画 RRG
# ======================
num_targets = len(targets)
cols = min(2, num_targets)
rows = (num_targets + cols - 1) // cols

fig, axes = plt.subplots(rows, cols, figsize=(6 * cols, 6 * rows))
if num_targets == 1:
    axes = [axes]
else:
    axes = axes.flatten()

for i, (name, code) in enumerate(targets.items()):
    ax = axes[i]
    price = get_etf(code)
    df = compute_rrg(price, benchmark)

    trail = df.iloc[-TRAIL_DAYS:]
    
    # 准备箭头数据
    x = trail["RS"].values
    y = trail["MOM"].values
    u = np.diff(x)
    v = np.diff(y)
    
    # 画轨迹线
    ax.plot(x, y, color='gray', alpha=0.3, linewidth=1)
    
    # 画箭头 (从点 i 指向 i+1)
    # angles='xy', scale_units='xy', scale=1 确保箭头方向和长度与数据坐标一致
    ax.quiver(x[:-1], y[:-1], u, v, angles='xy', scale_units='xy', scale=1, 
              color='tab:blue', width=0.006, headwidth=4, headlength=5, alpha=0.8)
    
    # 标记最新点
    ax.scatter(x[-1], y[-1], color='red', s=50, zorder=5)
    
    # 坐标轴和网格
    ax.axhline(0, linestyle="--", alpha=0.5, color='black')
    ax.axvline(0, linestyle="--", alpha=0.5, color='black')
    
    ax.set_title(f"{name} ({code})")
    ax.set_xlabel("Relative Strength (RS)")
    ax.set_ylabel("Momentum (MOM)")
    ax.grid(True, alpha=0.3)

# 隐藏多余的子图
for j in range(i + 1, len(axes)):
    axes[j].axis('off')

plt.suptitle("ETF Relative Rotation Graph (RRG)", fontsize=16)
plt.tight_layout()
plt.show()
