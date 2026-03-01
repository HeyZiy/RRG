import sqlite3
import os

class Database:
    def __init__(self, db_name='asset_tracker.db'):
        self.db_name = db_name
        self.conn = None
        self.cursor = None
        self._init_db()
    
    def _init_db(self):
        # 确保数据库文件所在目录存在
        db_dir = os.path.dirname(self.db_name)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)
        
        # 连接数据库
        self.conn = sqlite3.connect(self.db_name)
        self.cursor = self.conn.cursor()
        
        # 创建账户表
        self.cursor.execute('''
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT
        )''')
        
        # 创建资产表
        self.cursor.execute('''
        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            asset_type TEXT NOT NULL,
            shares REAL NOT NULL,
            cost_price REAL NOT NULL,
            current_price REAL DEFAULT 0,
            last_updated TEXT,
            FOREIGN KEY (account_id) REFERENCES accounts (id)
        )''')
        
        # 创建配置目标表
        self.cursor.execute('''
        CREATE TABLE IF NOT EXISTS targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            asset_type TEXT NOT NULL,
            target_percentage REAL NOT NULL,
            FOREIGN KEY (account_id) REFERENCES accounts (id),
            UNIQUE(account_id, asset_type)
        )''')
        
        # 插入默认账户
        default_accounts = ['长钱', '稳钱', '卫星仓', '短线']
        for account in default_accounts:
            try:
                self.cursor.execute('INSERT OR IGNORE INTO accounts (name) VALUES (?)', (account,))
                # 获取账户ID
                self.cursor.execute('SELECT id FROM accounts WHERE name = ?', (account,))
                account_id = self.cursor.fetchone()[0]
                # 插入默认现金资产
                self.cursor.execute('''
                INSERT OR IGNORE INTO assets (account_id, name, code, asset_type, shares, cost_price, current_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (account_id, '现金', 'CASH', 'cash', 10000, 1, 1))
                # 设置默认配置目标（100%现金）
                self.cursor.execute('''
                INSERT OR REPLACE INTO targets (account_id, asset_type, target_percentage)
                VALUES (?, ?, ?)
                ''', (account_id, 'cash', 100))
            except sqlite3.IntegrityError:
                pass
        
        self.conn.commit()
    
    def close(self):
        if self.conn:
            self.conn.close()
    
    # 账户相关操作
    def get_accounts(self):
        self.cursor.execute('SELECT * FROM accounts')
        return self.cursor.fetchall()
    
    def get_account_by_id(self, account_id):
        self.cursor.execute('SELECT * FROM accounts WHERE id = ?', (account_id,))
        return self.cursor.fetchone()
    
    # 资产相关操作
    def get_assets(self, account_id=None):
        if account_id:
            self.cursor.execute('SELECT * FROM assets WHERE account_id = ?', (account_id,))
        else:
            self.cursor.execute('SELECT * FROM assets')
        return self.cursor.fetchall()
    
    def add_asset(self, account_id, name, code, asset_type, shares, cost_price):
        self.cursor.execute('''
        INSERT INTO assets (account_id, name, code, asset_type, shares, cost_price)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (account_id, name, code, asset_type, shares, cost_price))
        self.conn.commit()
        return self.cursor.lastrowid
    
    def update_asset(self, asset_id, **kwargs):
        set_clause = ', '.join([f'{key} = ?' for key in kwargs.keys()])
        values = list(kwargs.values()) + [asset_id]
        self.cursor.execute(f'''
        UPDATE assets
        SET {set_clause}
        WHERE id = ?
        ''', values)
        self.conn.commit()
        return self.cursor.rowcount
    
    def delete_asset(self, asset_id):
        self.cursor.execute('DELETE FROM assets WHERE id = ?', (asset_id,))
        self.conn.commit()
        return self.cursor.rowcount
    
    # 配置目标相关操作
    def get_targets(self, account_id=None):
        if account_id:
            self.cursor.execute('SELECT * FROM targets WHERE account_id = ?', (account_id,))
        else:
            self.cursor.execute('SELECT * FROM targets')
        return self.cursor.fetchall()
    
    def add_target(self, account_id, asset_type, target_percentage):
        try:
            self.cursor.execute('''
            INSERT OR REPLACE INTO targets (account_id, asset_type, target_percentage)
            VALUES (?, ?, ?)
            ''', (account_id, asset_type, target_percentage))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Error adding target: {e}")
            return False
    
    def update_target(self, target_id, target_percentage):
        self.cursor.execute('''
        UPDATE targets
        SET target_percentage = ?
        WHERE id = ?
        ''', (target_percentage, target_id))
        self.conn.commit()
        return self.cursor.rowcount
    
    def delete_target(self, target_id):
        self.cursor.execute('DELETE FROM targets WHERE id = ?', (target_id,))
        self.conn.commit()
        return self.cursor.rowcount
