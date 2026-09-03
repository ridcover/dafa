import os
import argparse
import sys
from pathlib import Path

def setup_argparse():
    parser = argparse.ArgumentParser(description="Native Checker Generator")
    parser.add_argument("--mode", choices=["unit", "validator"], required=True, help="Mode of generation")
    parser.add_argument("--target", help="Target file to test (required for mode unit)")
    parser.add_argument("--name", required=True, help="Name of the test or validator")
    parser.add_argument("--apply", action="store_true", help="Actually create the file")
    return parser.parse_args()

def get_project_root():
    # Assuming this script is in .agents/skills/native_checker_gen/generator.py
    # and the project root is the CWD where the agent runs it from.
    return Path(os.getcwd())

def scaffold_unit_test(root_dir, target_file, test_name, apply_flag):
    if not target_file:
        print("[ERROR] --target is required for unit mode.")
        sys.exit(1)
        
    target_path = Path(target_file)
    if not target_path.exists():
        print(f"[WARNING] Target file {target_file} does not exist locally. Proceeding anyway...")
    
    # Conventional Jest test location: next to the file in __tests__ folder, or same folder with .test.js
    # We will put it in the same directory under __tests__
    test_dir = target_path.parent / "__tests__"
    test_file_path = test_dir / f"{test_name}.test.js"
    
    # Calculate relative path from test file to target file
    # Since test is in __tests__, the target is in '../'
    rel_import = f"../{target_path.name}"
    if rel_import.endswith(".js"):
        rel_import = rel_import[:-3]
        
    template = f"""/**
 * Unit Test scaffolded by Native Checker Generator
 * Target: {target_file}
 */

// Import your target modules here
// const {{ }} = require('{rel_import}'); // For CommonJS
// import {{ }} from '{rel_import}'; // For ES Modules

describe('{test_name}', () => {{
  beforeAll(() => {{
    // Setup before all tests
  }});

  afterAll(() => {{
    // Teardown after all tests
  }});

  it('should behave as expected', () => {{
    // Arrange
    
    // Act
    
    // Assert
    throw new Error('Test belum diimplementasikan! Hapus baris ini setelah Anda menulis logika pengujian.');
  }});
}});
"""
    
    if not apply_flag:
        print(f"[DRY RUN] Will create unit test at: {test_file_path}")
        print("Run with --apply to actually write the file.")
        return
        
    test_dir.mkdir(parents=True, exist_ok=True)
    with open(test_file_path, "w", encoding="utf-8") as f:
        f.write(template)
        
    print(f"[SUCCESS] Unit test scaffolded at: {test_file_path}")
    print(f"Run it with: npx jest {test_file_path}")

def scaffold_validator(root_dir, validator_name, apply_flag):
    scripts_dir = root_dir / "scripts" / "validators"
    
    validator_path = scripts_dir / f"{validator_name}.js"
    
    template = f"""/**
 * Standalone Validator scaffolded by Native Checker Generator
 * Name: {validator_name}
 */

// Load environment variables if needed
require('dotenv').config({{ path: '.env.development' }}); // Adjust path as needed

async function main() {{
  try {{
    console.log('[VALIDATOR] Starting {validator_name}...');
    
    // 1. Connect to Database or Setup State here
    // const db = await connectDB();
    
    // 2. Perform Checks
    // const inconsistencies = await db.query('...');
    
    // 3. Report Results
    // if (inconsistencies.length > 0) throw new Error('Found bugs!');
    
    throw new Error('Validator belum diimplementasikan! Hapus baris ini setelah logika pengecekan ditulis.');
    
    console.log('[VALIDATOR] Check passed successfully!');
    process.exit(0);
  }} catch (error) {{
    console.error('[VALIDATOR] FAILED:', error.message);
    process.exit(1);
  }}
}}

main();
"""

    if not apply_flag:
        print(f"[DRY RUN] Will create standalone validator at: {validator_path}")
        print("Run with --apply to actually write the file.")
        return
        
    scripts_dir.mkdir(parents=True, exist_ok=True)
    with open(validator_path, "w", encoding="utf-8") as f:
        f.write(template)
        
    print(f"[SUCCESS] Standalone validator scaffolded at: {validator_path}")
    print(f"Run it with: node {validator_path}")

def main():
    args = setup_argparse()
    root = get_project_root()
    
    if args.mode == "unit":
        scaffold_unit_test(root, args.target, args.name, args.apply)
    elif args.mode == "validator":
        scaffold_validator(root, args.name, args.apply)

if __name__ == "__main__":
    main()
