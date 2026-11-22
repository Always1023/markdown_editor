# I-018 死代码清单脚本：静态 import 图上的可达性闭包。
# 死集 = src/ + electron/ 下、从（活入口 ∪ 全部测试文件 ∪ 保留集）都不可达的文件。
# 保留集：src/preload/**（AGENTS 第 3 条的类型契约面，tsc 程序的一部分）与
# src/types/*.d.ts、src/env.d.ts（tsconfig 环境声明）。
# 用法：
#   python scripts/dead_code_manifest.py            # 输出清单 + 自检断言
#   python scripts/dead_code_manifest.py --delete   # 删除清单内文件（先跑无参数版核对）
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
ELECTRON = os.path.join(ROOT, 'electron')
TESTS = os.path.join(ROOT, 'tests')

IMPORT_RE = re.compile(
    r"""(?:import\s[^'"`]*?from\s*|import\s*\(\s*|import\s*|export\s[^'"`]*?from\s*|require\s*\(\s*)['"]([^'"]+)['"]"""
)
# 注：裸 import\s* 兜到 side-effect import（import '...'）；from / 动态形式排在前面，
# 普通 import 先被具体形式匹配，不受裸形式影响。
WORKER_EDGES = {
    os.path.normpath('src/components/editor/markdown-preview/document-worker/use-markdown-preview-document.ts'):
        os.path.normpath('src/components/editor/markdown-preview/document-worker/markdown-preview-document.worker.ts'),
    os.path.normpath('src/lib/monaco-languages/plugin-syntax-runtime.ts'):
        os.path.normpath('src/lib/monaco-languages/plugin-grammar.worker.ts'),
}
LIVE_ROOTS = [
    'src/main.tsx',
    'src/app/App.tsx',
    'src/app/demo-file-io.ts',
    'src/app/export-client.ts',
    'src/app/export-html.ts',
    'src/app/settings-persistence.ts',
    'src/store/index.ts',
    'electron/main/index.ts',
    'electron/preload/index.ts',
]

def is_source_file(path):
    return path.endswith(('.ts', '.tsx'))

def is_test_file(path):
    rel = os.path.relpath(path, ROOT)
    return rel.startswith('tests' + os.sep) or '.test.' in os.path.basename(path)

def is_ambient(path):
    return path.endswith('.d.ts') or os.path.basename(path) == 'env.d.ts'

def keep_protected(rel):
    # 保留集：preload 类型契约面 + tsconfig 环境声明。
    return rel.startswith('src' + os.sep + 'preload') or is_ambient(rel)

def resolve(spec, from_file):
    if spec.startswith('@/'):
        base = os.path.join(ROOT, 'src', spec[2:])
        return resolve_file(base)
    if spec.startswith('.'):
        base = os.path.normpath(os.path.join(os.path.dirname(from_file), spec))
        return resolve_file(base)
    return None  # 包依赖 / 虚拟模块

def resolve_file(base):
    for candidate in (base, base + '.ts', base + '.tsx',
                      os.path.join(base, 'index.ts'), os.path.join(base, 'index.tsx')):
        candidate = os.path.normpath(candidate)
        if os.path.isfile(candidate):
            return candidate
    return None

def main():
    graph = {}
    all_files = []
    for base in (SRC, ELECTRON):
        for dirpath, _dirnames, filenames in os.walk(base):
            for name in filenames:
                path = os.path.normpath(os.path.join(dirpath, name))
                if is_source_file(path):
                    all_files.append(path)
    tests_files = []
    for base in (SRC, TESTS):
        for dirpath, _dirnames, filenames in os.walk(base):
            for name in filenames:
                path = os.path.normpath(os.path.join(dirpath, name))
                if is_source_file(path) and is_test_file(path):
                    tests_files.append(path)

    for path in all_files + tests_files:
        with open(path, encoding='utf-8', errors='replace') as handle:
            text = handle.read()
        targets = set()
        for match in IMPORT_RE.finditer(text):
            resolved = resolve(match.group(1), path)
            if resolved and is_source_file(resolved) and not is_ambient(resolved):
                targets.add(resolved)
        rel = os.path.relpath(path, ROOT)
        if rel.replace('\\', '/') in {k.replace('\\', '/') for k in WORKER_EDGES}:
            targets.add(os.path.normpath(os.path.join(ROOT, WORKER_EDGES[os.path.normpath(rel)])))
        graph[path] = targets

    roots = set()
    for rel in LIVE_ROOTS:
        path = os.path.normpath(os.path.join(ROOT, rel))
        assert os.path.isfile(path), 'live root missing: ' + rel
        roots.add(path)
    roots.update(tests_files)
    roots.update(path for path in all_files if keep_protected(os.path.relpath(path, ROOT)))

    reachable = set()
    stack = list(roots)
    while stack:
        node = stack.pop()
        if node in reachable:
            continue
        reachable.add(node)
        stack.extend(graph.get(node, ()))

    candidates = [path for path in all_files
                  if path not in reachable and not keep_protected(os.path.relpath(path, ROOT))]

    # 自检断言（A1）：活文件必须在活集，已知死文件必须在死集。
    def in_reachable(rel):
        return os.path.normpath(os.path.join(ROOT, rel)) in reachable
    def in_candidates(rel):
        return os.path.normpath(os.path.join(ROOT, rel)) in set(candidates)
    assert in_reachable('src/app/App.tsx'), 'App.tsx 被误判为死代码'
    assert in_reachable('src/components/editor/rich-markdown/instance/RichMarkdownEditor.tsx'), '活编辑器被误判'
    assert in_reachable('src/components/editor/rich-markdown/review/rich-markdown-review-annotations.ts'), 'review 活链被误判'
    assert in_candidates('src/components/sidebar/workspace-card/activity/useWorktreeAgentRows.ts'), '已知死文件未被识别'
    assert in_candidates('electron/main/filesystem/local-file-io/filesystem-symlink-ancestor.ts'), 'electron 死文件未被识别'

    by_dir = defaultdict(int)
    for path in candidates:
        rel = os.path.relpath(path, ROOT)
        by_dir[os.path.dirname(rel)] += 1

    print('待删文件总数: %d' % len(candidates))
    print('按目录（前 25）:')
    for directory, count in sorted(by_dir.items(), key=lambda kv: -kv[1])[:25]:
        print('  %4d  %s' % (count, directory))
    print('测试文件数（保留）: %d' % len(tests_files))
    manifest = os.path.join(ROOT, 'scripts', 'dead-code-manifest.txt')
    with open(manifest, 'w', encoding='utf-8', newline='') as handle:
        for path in sorted(candidates):
            handle.write(os.path.relpath(path, ROOT).replace('\\', '/') + '\n')
    print('清单已写: %s' % os.path.relpath(manifest, ROOT))

    if '--delete' in sys.argv:
        for path in candidates:
            os.remove(path)
        # 清空删空的目录（自底向上，直到仓库根的 src/ electron/ 为止）。
        dirs = sorted({os.path.dirname(path) for path in candidates}, key=len, reverse=True)
        removed_dirs = 0
        for directory in dirs:
            try:
                os.rmdir(directory)
                removed_dirs += 1
            except OSError:
                pass
        print('已删除 %d 个文件与 %d 个空目录' % (len(candidates), removed_dirs))

if __name__ == '__main__':
    main()
