// I-011 文件树（纯展示）：MarkdownDocument 列表按 relativePath 分段建树，
// 目录可折叠（默认展开），文件点击交给 onOpen；activePath 高亮当前文件。
// 数据与 watch 在 use-file-tree，多标签 / 打开动作在 App 装配层。
import { useMemo, useState } from 'react'
import type { MarkdownDocument } from '@/shared/file-listing/file-document'

type FileTreeNode =
  | { type: 'dir'; name: string; segmentPath: string; children: FileTreeNode[] }
  | { type: 'file'; name: string; filePath: string }

function buildTree(entries: MarkdownDocument[]): FileTreeNode[] {
  const rootChildren: FileTreeNode[] = []
  const dirIndex = new Map<string, FileTreeNode[]>()

  const ensureDir = (segments: string[]): FileTreeNode[] => {
    let children = rootChildren
    let prefix = ''
    for (const segment of segments) {
      prefix = prefix ? `${prefix}/${segment}` : segment
      let next = dirIndex.get(prefix)
      if (!next) {
        const dir: FileTreeNode = {
          type: 'dir',
          name: segment,
          segmentPath: prefix,
          children: []
        }
        children.push(dir)
        next = dir.children
        dirIndex.set(prefix, next)
      }
      children = next
    }
    return children
  }

  for (const document of entries) {
    const segments = document.relativePath.replace(/\\/g, '/').split('/')
    const name = segments.pop() ?? document.name
    ensureDir(segments).push({ type: 'file', name, filePath: document.filePath })
  }

  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1
      }
      return a.name.localeCompare(b.name, 'zh-Hans-CN')
    })
    for (const node of nodes) {
      if (node.type === 'dir') {
        sortNodes(node.children)
      }
    }
    return nodes
  }
  return sortNodes(rootChildren)
}

function TreeNodes({
  nodes,
  depth,
  activePath,
  onOpen
}: {
  nodes: FileTreeNode[]
  depth: number
  activePath: string | null
  onOpen: (filePath: string) => void
}): React.JSX.Element {
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(() => new Set())
  const toggleDir = (segmentPath: string): void => {
    setCollapsedDirs((previous) => {
      const next = new Set(previous)
      if (next.has(segmentPath)) {
        next.delete(segmentPath)
      } else {
        next.add(segmentPath)
      }
      return next
    })
  }
  return (
    <ul role="tree" className="m-0 list-none p-0 text-sm">
      {nodes.map((node) =>
        node.type === 'dir' ? (
          <li key={node.segmentPath}>
            <button
              type="button"
              className="flex w-full items-center gap-1 rounded px-2 py-1 text-left hover:bg-muted"
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => toggleDir(node.segmentPath)}
              aria-expanded={!collapsedDirs.has(node.segmentPath)}
            >
              <span className="text-muted-foreground">
                {collapsedDirs.has(node.segmentPath) ? '▸' : '▾'}
              </span>
              <span className="truncate">{node.name}</span>
            </button>
            {!collapsedDirs.has(node.segmentPath) && (
              <TreeNodes
                nodes={node.children}
                depth={depth + 1}
                activePath={activePath}
                onOpen={onOpen}
              />
            )}
          </li>
        ) : (
          <li key={node.filePath}>
            <button
              type="button"
              className={`flex w-full items-center rounded px-2 py-1 text-left hover:bg-muted ${
                activePath === node.filePath ? 'bg-muted font-medium' : ''
              }`}
              style={{ paddingLeft: 8 + depth * 14 + 14 }}
              onClick={() => onOpen(node.filePath)}
            >
              <span className="truncate">{node.name}</span>
            </button>
          </li>
        )
      )}
    </ul>
  )
}

export function FileTree({
  entries,
  activePath,
  onOpen
}: {
  entries: MarkdownDocument[]
  activePath: string | null
  onOpen: (filePath: string) => void
}): React.JSX.Element {
  const tree = useMemo(() => buildTree(entries), [entries])
  if (tree.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">此文件夹还没有 .md 文件</p>
  }
  return <TreeNodes nodes={tree} depth={0} activePath={activePath} onOpen={onOpen} />
}
