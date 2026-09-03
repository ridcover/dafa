"""
Smart Directory Mapper (Tree Viewer)
==================================
Generates compact, .gitignore-aware directory tree.
Uses shared tree_gen module.
"""
import os
import sys

# Import shared tree generator
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from tree_gen.tree_gen import generate_tree, generate_simple_tree, parse_gitignore

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    if len(sys.argv) < 2:
        print("Usage: python tree_viewer.py <directory_path> [max_depth]")
        print("\nOptions:")
        print("  max_depth  : Maximum tree depth (default: 3, 0 = unlimited)")
        print("  --simple   : Use simple output (no icons)")
        sys.exit(1)

    target_dir = sys.argv[1]
    max_depth = 3  # default
    use_simple = False

    # Parse args
    for arg in sys.argv[2:]:
        if arg == '--simple':
            use_simple = True
        else:
            try:
                max_depth = int(arg)
            except ValueError:
                pass

    if not os.path.isdir(target_dir):
        print(f"Error: Directory '{target_dir}' does not exist.")
        sys.exit(1)

    target_dir = os.path.abspath(target_dir)
    ignore_patterns = parse_gitignore(target_dir)

    print(f"Directory Tree for: {target_dir}")
    print(f"Max Depth: {'unlimited' if max_depth == 0 else max_depth}")
    print(".")

    if use_simple:
        tree = generate_simple_tree(target_dir, max_depth=max_depth)
    else:
        tree = generate_tree(target_dir, max_depth=max_depth, ignore_patterns=ignore_patterns)

    print(tree)

if __name__ == "__main__":
    main()
