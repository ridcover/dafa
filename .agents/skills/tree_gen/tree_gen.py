"""
Shared Tree Generation Module
============================
Pure, reusable tree generation logic.
Used by context_mapper and smart_tree.
"""
import os
import sys
import fnmatch
from typing import List, Optional

def parse_gitignore(dir_path: str, project_root: str = None) -> List[str]:
    """Parse .gitignore from dir_path AND project root (if different)."""
    default_ignore = [
        '.git', '.agents', 'node_modules', 'vendor', '__pycache__',
        '.DS_Store', 'dist', 'build', '.idea', '.vscode', '.history',
        'quarantine', '.backup_replace', 'uploads', 'public',
        '.dart_tool', '.gradle', '.pub-cache', 'Pods'
    ]

    gitignore_path = os.path.join(dir_path, '.gitignore')
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    if line.endswith('/'):
                        line = line[:-1]
                    default_ignore.append(line)
    if project_root and project_root != dir_path:
        root_gi = os.path.join(project_root, '.gitignore')
        if os.path.exists(root_gi):
            with open(root_gi, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        if line.endswith('/'):
                            line = line[:-1]
                        if line not in default_ignore:
                            default_ignore.append(line)
    return default_ignore

def is_ignored(name: str, ignore_patterns: List[str], full_path: str = "") -> bool:
    """Check if a file/directory should be ignored."""
    for pattern in ignore_patterns:
        if fnmatch.fnmatch(name, pattern) or fnmatch.fnmatch(name, pattern + '/*'):
            return True
        if full_path:
            normalized = full_path.replace('\\', '/')
            if fnmatch.fnmatch(normalized, pattern) or fnmatch.fnmatch(normalized, pattern + '/*'):
                return True
    return False

def generate_tree(
    dir_path: str,
    prefix: str = "",
    depth: int = 0,
    max_depth: int = 3,
    ignore_patterns: Optional[List[str]] = None,
    include_files: bool = True
) -> str:
    """
    Generate tree structure with icons.

    Args:
        dir_path: Directory to scan
        prefix: Prefix for indentation (internal use)
        depth: Current depth (internal use)
        max_depth: Maximum depth (0 = unlimited)
        ignore_patterns: List of patterns to ignore
        include_files: Whether to include files

    Returns:
        Tree structure as string
    """
    if os.path.islink(dir_path):
        return f"{prefix}└── [Symlink]\n"
    if depth > max_depth and max_depth > 0:
        return f"{prefix}└── ... (max depth reached)\n"

    if ignore_patterns is None:
        ignore_patterns = parse_gitignore(dir_path)

    tree_str = ""

    try:
        entries = sorted(os.listdir(dir_path))
    except PermissionError:
        return f"{prefix}└── [Permission Denied]\n"
    except Exception:
        return f"{prefix}└── [Error reading directory]\n"

    entries = [e for e in entries if not is_ignored(e, ignore_patterns, os.path.join(dir_path, e))]
    entries_count = len(entries)

    for i, entry in enumerate(entries):
        is_last = (i == entries_count - 1)
        entry_path = os.path.join(dir_path, entry)
        connector = "└── " if is_last else "├── "

        if os.path.islink(entry_path):
            continue
        if os.path.isdir(entry_path):
            tree_str += f"{prefix}{connector}📁 {entry}/\n"
            extension = "    " if is_last else "│   "
            tree_str += generate_tree(entry_path, prefix + extension, depth + 1, max_depth, ignore_patterns, include_files)
        elif include_files:
            tree_str += f"{prefix}{connector}📄 {entry}\n"

    return tree_str

def generate_simple_tree(
    dir_path: str,
    prefix: str = "",
    depth: int = 0,
    max_depth: int = 0,
    ignore_patterns: Optional[List[str]] = None
) -> str:
    """Simple tree without icons (like standard tree command)."""
    if os.path.islink(dir_path):
        return f"{prefix}└── [Symlink]\n"
    if depth > max_depth and max_depth > 0:
        return ""

    if ignore_patterns is None:
        ignore_patterns = parse_gitignore(dir_path)

    tree_str = ""

    try:
        entries = sorted(os.listdir(dir_path))
    except Exception:
        return ""

    entries = [e for e in entries if not is_ignored(e, ignore_patterns, os.path.join(dir_path, e))]
    entries_count = len(entries)

    for i, entry in enumerate(entries):
        is_last = (i == entries_count - 1)
        entry_path = os.path.join(dir_path, entry)
        connector = "└── " if is_last else "├── "

        if os.path.islink(entry_path):
            continue
        if os.path.isdir(entry_path):
            tree_str += f"{prefix}{connector}{entry}/\n"
            extension = "    " if is_last else "│   "
            tree_str += generate_simple_tree(entry_path, prefix + extension, depth + 1, max_depth, ignore_patterns)
        else:
            tree_str += f"{prefix}{connector}{entry}\n"

    return tree_str

def get_tree_stats(dir_path: str, ignore_patterns: Optional[List[str]] = None) -> dict:
    """Get statistics about the directory tree."""
    if ignore_patterns is None:
        ignore_patterns = parse_gitignore(dir_path)

    stats = {"total_files": 0, "total_dirs": 0, "max_depth": 0, "file_types": {}}

    def walk(path: str, depth: int = 0):
        if os.path.islink(path):
            return
        stats["max_depth"] = max(stats["max_depth"], depth)
        try:
            entries = sorted(os.listdir(path))
        except Exception:
            return

        entries = [e for e in entries if not is_ignored(e, ignore_patterns, os.path.join(path, e))]

        for entry in entries:
            entry_path = os.path.join(path, entry)
            if os.path.islink(entry_path):
                continue
            if os.path.isdir(entry_path):
                stats["total_dirs"] += 1
                walk(entry_path, depth + 1)
            else:
                stats["total_files"] += 1
                ext = os.path.splitext(entry)[1] or "no_ext"
                stats["file_types"][ext] = stats["file_types"].get(ext, 0) + 1

    walk(dir_path)
    return stats
