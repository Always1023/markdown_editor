// Orca 的 markdown 管线经 hast-util-to-mdast 的模块增强拿到 mdast Data.hProperties；
// 本产品未安装该包，就地声明同一形状（只增类型，不改运行时）。
import type { Properties } from 'hast'

declare module 'mdast' {
  interface Data {
    hProperties?: Properties
  }
}

export {}
