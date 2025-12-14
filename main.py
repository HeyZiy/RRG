import os

# --- Network / Proxy notes ---
# AkShare 的部分接口会请求 eastmoney 域名（例如 80.push2.eastmoney.com）。
# 如果你的环境里配置了 HTTP(S)_PROXY，但代理不可用，就会触发 ProxyError。
# 下面默认让 eastmoney 域名走直连（通过 NO_PROXY 绕过代理）。
# 如需彻底禁用代理（对所有请求都直连），可在环境变量里设置：RRG_DISABLE_PROXY=1

if os.environ.get("RRG_DISABLE_PROXY", "0") == "1":
    for _k in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ):
        os.environ.pop(_k, None)

if os.environ.get("RRG_EASTMONEY_NO_PROXY", "1") != "0":
    _hosts = ["80.push2.eastmoney.com", ".eastmoney.com", "eastmoney.com"]
    _existing = os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or ""
    _parts = [p.strip() for p in _existing.split(",") if p.strip()]
    _lower = {p.lower() for p in _parts}
    for _h in _hosts:
        if _h.lower() not in _lower:
            _parts.append(_h)
    _merged = ",".join(_parts)
    os.environ["NO_PROXY"] = _merged
    os.environ["no_proxy"] = _merged

import akshare as ak
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import zscore
import requests

# ======================
# 参数区（你之后重点调的地方）
# ======================
START_DATE = "20230101"
END_DATE = "20251201"
LOOKBACK_RS = 20      # 相对强弱平滑窗口
LOOKBACK_MOM = 10     # 动量窗口
TRAIL_DAYS = 20       # 画多少天的轨迹

# ======================
# 1. 获取指数数据
# ======================
def get_index(code):
    def _fetch():
        return ak.index_zh_a_hist(
            symbol=code,
            period="daily",
            start_date=START_DATE,
            end_date=END_DATE,
        )

    try:
        df = _fetch()
    except requests.exceptions.ConnectionError as e:
        # 检查是否是域名解析错误
        msg = str(e)
        is_dns_error = "NameResolutionError" in msg or "getaddrinfo failed" in msg
        
        # 如果是 DNS 错误，且当前启用了 RRG_EASTMONEY_NO_PROXY（即强制直连），尝试回退到使用代理
        if is_dns_error and os.environ.get("RRG_EASTMONEY_NO_PROXY", "1") != "0":
            print(f"Warning: 捕获到域名解析错误 ({e})。尝试移除 NO_PROXY 设置（使用系统代理）重试...")
            
            # 临时移除 eastmoney 相关域名从 NO_PROXY
            _hosts = {"80.push2.eastmoney.com", ".eastmoney.com", "eastmoney.com"}
            _backup_env = {}
            
            for k in ["NO_PROXY", "no_proxy"]:
                val = os.environ.get(k, "")
                if val:
                    _backup_env[k] = val
                    parts = [p.strip() for p in val.split(",") if p.strip()]
                    # 过滤掉 eastmoney 相关的
                    new_parts = [p for p in parts if p not in _hosts and p not in _hosts] # simple check
                    # 更严谨的过滤
                    new_parts = [p for p in parts if p not in _hosts]
                    os.environ[k] = ",".join(new_parts)
            
            try:
                df = _fetch()
                print("重试成功！建议设置环境变量 RRG_EASTMONEY_NO_PROXY=0 以永久生效。")
            except Exception as retry_e:
                # 恢复环境变量（可选，但为了保持状态一致性）
                for k, v in _backup_env.items():
                    os.environ[k] = v
                    
                raise RuntimeError(
                    "重试失败。请检查网络连接或代理配置。\n"
                    "尝试了直连和代理两种方式，均无法解析域名或连接失败。"
                ) from retry_e
        else:
            if is_dns_error:
                 raise RuntimeError(
                    "请求数据时发生域名解析错误 (NameResolutionError)。\n"
                    "原因可能是：\n"
                    "1. 你的网络环境无法直接解析 eastmoney 域名（可能是内网或防火墙限制）。\n"
                    "2. 检查网络连接是否正常。"
                ) from e
            raise e

    except requests.exceptions.ProxyError as e:
        raise RuntimeError(
            "请求数据时发生代理错误：你的环境可能配置了 HTTP(S)_PROXY，但代理不可用。\n"
            "处理方式：\n"
            "1) 让 eastmoney 直连：保持默认即可（已设置 NO_PROXY 包含 eastmoney.com）。\n"
            "2) 或彻底禁用代理：在运行前设置环境变量 RRG_DISABLE_PROXY=1。\n"
            "3) 或修复/替换系统代理配置。"
        ) from e
        
    df["date"] = pd.to_datetime(df["日期"])
    df = df.set_index("date")
    return df["收盘"].astype(float)

# ======================
# 2. 构建 RRG 指标
# ======================
def compute_rrg(price, benchmark):
    rs = price / benchmark
    rs_smooth = rs.rolling(LOOKBACK_RS).mean()
    rs_norm = zscore(rs_smooth.dropna())

    mom = rs_norm - rs_norm.shift(LOOKBACK_MOM)
    mom = mom.dropna()

    df = pd.DataFrame({
        "RS": rs_norm.loc[mom.index],
        "MOM": mom
    })
    return df

# ======================
# 3. 示例：行业 vs 沪深300
# ======================
benchmark = get_index("sh000300")  # 沪深300

targets = {
    "消费": "000932",
    "医药": "000933",
    "新能源": "399808",
    "科技": "399006"
}

plt.figure(figsize=(8, 8))

for name, code in targets.items():
    price = get_index(code)
    df = compute_rrg(price, benchmark)

    trail = df.iloc[-TRAIL_DAYS:]
    plt.plot(trail["RS"], trail["MOM"], marker="o", label=name)
    plt.scatter(trail["RS"].iloc[-1], trail["MOM"].iloc[-1])

# 原点 & 轴线
plt.axhline(0, color="gray", linestyle="--", alpha=0.5)
plt.axvline(0, color="gray", linestyle="--", alpha=0.5)

plt.xlabel("Relative Strength")
plt.ylabel("Momentum")
plt.title("Relative Rotation Graph (RRG)")
plt.legend()
plt.grid(alpha=0.3)
plt.show()
