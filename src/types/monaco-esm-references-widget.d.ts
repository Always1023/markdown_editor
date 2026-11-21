// Monaco 引用预览控件深路径无类型；消费点只把它当作可替换的构造器引用（or unknown 断言），
// 这里声明成与用法等价的任意类形状即可（形状自 Orca env.d.ts 同位推断）。
export class ReferenceWidget {
  static readonly ctor: unknown
  constructor(...args: never[])
}
