import os
import sys
import re

def parse_env(env_path):
    config = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    val = val.strip()
                    # Quote-aware parsing: preserve # literally inside double/single quotes
                    if val.startswith('"') and val.endswith('"') and len(val) >= 2:
                        val = val[1:-1]
                    elif val.startswith("'") and val.endswith("'") and len(val) >= 2:
                        val = val[1:-1]
                    else:
                        # Unquoted: treat first # as comment delimiter
                        if '#' in val:
                            val = val.split('#', 1)[0].strip()
                    config[key.strip()] = val
    return config

def static_analysis_fallback(project_root):
    print("### 🔄 Universal Fallback: Static Code Analysis Mode")
    print("Could not connect via network driver or DB is unknown. Scanning source code for models...\n")
    
    found_models = False
    
    # 1. Check Prisma
    prisma_path = os.path.join(project_root, 'prisma', 'schema.prisma')
    if os.path.exists(prisma_path):
        print("#### Prisma Schema Found")
        found_models = True
        with open(prisma_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # simple extract model blocks
            models = re.findall(r'model\s+(\w+)\s+\{([^}]+)\}', content)
            for m_name, m_body in models:
                print(f"- **{m_name}**")
                lines = [l.strip() for l in m_body.strip().split('\n') if l.strip() and not l.strip().startswith('//')]
                for l in lines:
                    print(f"  - `{l}`")
                print("")
                
    # 2. If not prisma, check if it's a typical MVC / models structure
    if not found_models:
        search_dirs = ['models', 'src/models', 'lib/models', 'app/Models']
        for sdir in search_dirs:
            full_path = os.path.join(project_root, sdir)
            if os.path.exists(full_path) and os.path.isdir(full_path):
                print(f"#### Application Models Found in `{sdir}`")
                found_models = True
                for root, _, files in os.walk(full_path):
                    for file in files:
                        if file.endswith(('.php', '.js', '.ts', '.dart', '.py')):
                            print(f"- `{file}`")
                print("\n*(Tip: Use Selective Reader on these model files to see their exact attributes)*")
                break
                
    if not found_models:
        print("No standard database schema or model folder found via static analysis. Project might not have a database layer yet, or it uses a custom structure.")


def extract_mysql(config):
    try:
        import pymysql
    except ImportError:
        print("Error: `pymysql` module is not installed. Run `pip install pymysql` or fallback to static analysis.")
        return False
        
    try:
        host = config.get('DB_HOST', '127.0.0.1')
        port = int(config.get('DB_PORT', 3306))  # Support custom DB port
        user = config.get('DB_USERNAME', config.get('DB_USER', 'root'))
        password = config.get('DB_PASSWORD', '')
        database = config.get('DB_DATABASE', config.get('DB_NAME', ''))

        if not database:
            print("No DB_DATABASE or DB_NAME defined in .env")
            return False

        connection = pymysql.connect(host=host, port=port, user=user, password=password, database=database, cursorclass=pymysql.cursors.DictCursor)
        
        with connection.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            tables = [list(r.values())[0] for r in cursor.fetchall()]
            
            print(f"### MySQL Database: `{database}`\n")
            for table in tables:
                print(f"#### Table: `{table}`")
                print("| Column | Type | Null | Key | Default | Extra |")
                print("|---|---|---|---|---|---|")
                cursor.execute(f"DESCRIBE `{table}`")
                columns = cursor.fetchall()
                for col in columns:
                    print(f"| {col['Field']} | {col['Type']} | {col['Null']} | {col['Key']} | {col['Default']} | {col['Extra']} |")
                print("")
        connection.close()
        return True
    except Exception as e:
        print(f"MySQL Connection Failed: {e}")
        return False

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
        print("Usage: python extractor.py <project_root_dir>")
        sys.exit(0)
        
    project_root = sys.argv[1]
    env_path = os.path.join(project_root, '.env')
    
    config = parse_env(env_path)
    db_connection = config.get('DB_CONNECTION', '').lower()
    
    # Infer MySQL if missing DB_CONNECTION but has typical MySQL env vars (Node.js style)
    if not db_connection and ('DB_HOST' in config or 'DB_USER' in config):
        db_connection = 'mysql'
    
    print(f"Database Extractor (Target: {project_root})\n")
    
    success = False
    
    if db_connection == 'mysql' or db_connection == 'mariadb':
        print(f"Detected Database Engine: {db_connection.upper()} via .env (or inferred)")
        success = extract_mysql(config)
    elif db_connection == 'sqlite':
        print("Detected Database Engine: SQLITE. (Network extraction not fully implemented here yet, falling back to static analysis).")
        # Could add sqlite3 extraction logic here
    elif db_connection == 'pgsql' or db_connection == 'postgres':
        print("Detected Database Engine: POSTGRESQL. (Network extraction not fully implemented here yet, falling back to static analysis).")
        # Could add psycopg2 extraction logic here
    elif db_connection == 'firebase' or db_connection == 'firestore':
        print("Detected Database Engine: FIREBASE (NoSQL). Firebase is schemaless.")
        # Firebase has no fixed schema, force fallback to model analysis
    else:
        if db_connection:
            print(f"Unknown or Unsupported Database Engine: '{db_connection}'")
        else:
            print("No DB_CONNECTION found in .env, or .env is missing.")
            
    if not success:
        static_analysis_fallback(project_root)

if __name__ == "__main__":
    main()
