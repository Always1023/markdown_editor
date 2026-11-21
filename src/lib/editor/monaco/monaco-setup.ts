import { loader } from '@monaco-editor/react'
import { editorModelRegistry } from './editor-model-registry'
import * as monaco from 'monaco-editor'
import { typescript as monacoTS } from 'monaco-editor'
import 'monaco-editor/min/vs/editor/editor.main.css'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { registerAstroLanguage } from '@/lib/monaco-languages/register-astro.ts'
import { registerCMakeLanguage } from '@/lib/monaco-languages/register-cmake.ts'
import { registerCudaLanguage } from '@/lib/monaco-languages/register-cuda.ts'
import { registerDotenvLanguage } from '@/lib/monaco-languages/register-dotenv.ts'
import { registerGlimmerLanguages } from '@/lib/monaco-languages/register-glimmer.ts'
import { registerGroovyLanguage } from '@/lib/monaco-languages/register-groovy.ts'
import { registerJsonlLanguage } from '@/lib/monaco-languages/register-jsonl.ts'
import { registerLeanLanguage } from '@/lib/monaco-languages/register-lean.ts'
import { registerMarkdownLanguage } from '@/lib/monaco-languages/register-markdown.ts'
import { registerNimLanguage } from '@/lib/monaco-languages/register-nim.ts'
import { registerQuartoLanguage } from '@/lib/monaco-languages/register-quarto.ts'
import { registerShellMarkdownAliases } from '@/lib/monaco-languages/register-shell-markdown-aliases.ts'
import { registerSvelteLanguage } from '@/lib/monaco-languages/register-svelte.ts'
import { registerTypstLanguage } from '@/lib/monaco-languages/register-typst.ts'
import { registerVueLanguage } from '@/lib/monaco-languages/register-vue.ts'
import { registerZigLanguage } from '@/lib/monaco-languages/register-zig.ts'
import { installMonacoDelayerCancellationGuard } from '@/lib/editor/monaco/monaco-delayer-cancellation-guard.ts'
import { installMonacoDiffEditorDisposalGuard } from '@/lib/editor/monaco/monaco-diff-editor-disposal.ts'
import { installMonacoDiffViewportTokenization } from '@/lib/editor/monaco/monaco-diff-viewport-tokenization.ts'
import { installMonacoPeekReferencesPreviewOptions } from '@/lib/editor/monaco/monaco-peek-preview-options.ts'
import { installMonacoContextMenuPaste } from '@/components/editor/monaco/install-monaco-context-menu-paste'
import { runMonacoSetupSteps } from '@/lib/editor/monaco/monaco-setup-steps.ts'
import { installMonacoTsWorkerIdleStop } from '@/lib/editor/monaco/monaco-ts-worker-idle-stop.ts'
import { onPluginFontLoadsChanged } from '@/store/plugins/appearance/plugin-fonts'

globalThis.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new jsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker()
      case 'typescript':
      case 'javascript':
        return new tsWorker()
      default:
        return new editorWorker()
    }
  }
}

// Sandboxed workers cannot resolve project imports, and inline diffs can concatenate invalid programs; disable diagnostic categories while retaining useful tokenization.
const diagnosticsOptions = {
  noSemanticValidation: true,
  noSuggestionDiagnostics: true,
  noSyntaxValidation: true
}
monacoTS.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions)
monacoTS.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions)

// TSX/JSX share TypeScript/JavaScript defaults; preserve JSX parsing without emission to avoid TS17004 on tags.
monacoTS.typescriptDefaults.setCompilerOptions({
  ...monacoTS.typescriptDefaults.getCompilerOptions(),
  jsx: monacoTS.JsxEmit.Preserve
})
monacoTS.javascriptDefaults.setCompilerOptions({
  ...monacoTS.javascriptDefaults.getCompilerOptions(),
  jsx: monacoTS.JsxEmit.Preserve
})

runMonacoSetupSteps([
  ['Vue language registration', () => registerVueLanguage(monaco)],
  ['Svelte language registration', () => registerSvelteLanguage(monaco)],
  ['Astro language registration', () => registerAstroLanguage(monaco)],
  ['Glimmer language registration', () => registerGlimmerLanguages(monaco)],
  ['CUDA language registration', () => registerCudaLanguage(monaco)],
  ['Nim language registration', () => registerNimLanguage(monaco)],
  ['Lean language registration', () => registerLeanLanguage(monaco)],
  ['Typst language registration', () => registerTypstLanguage(monaco)],
  ['Zig language registration', () => registerZigLanguage(monaco)],
  ['Groovy language registration', () => registerGroovyLanguage(monaco)],
  ['CMake language registration', () => registerCMakeLanguage(monaco)],
  ['JSONL language registration', () => registerJsonlLanguage(monaco)],
  ['dotenv language registration', () => registerDotenvLanguage(monaco)],
  ['Quarto language registration', () => registerQuartoLanguage(monaco)],
  ['Markdown language registration', () => registerMarkdownLanguage(monaco)],
  ['shell Markdown alias registration', () => registerShellMarkdownAliases(monaco)],
  ['delayer cancellation guard', installMonacoDelayerCancellationGuard],
  ['diff editor disposal guard', () => installMonacoDiffEditorDisposalGuard(monaco)],
  ['diff viewport tokenization', () => installMonacoDiffViewportTokenization(monaco)],
  ['peek references preview options', installMonacoPeekReferencesPreviewOptions],
  // Sandboxed navigator.clipboard blocks Monaco Paste; use trusted IPC as native Cmd+V does.
  ['context-menu paste', () => installMonacoContextMenuPaste(monaco)],
  ['TS worker idle stop', () => installMonacoTsWorkerIdleStop(monaco)],
  // Monaco caches glyph widths, so a plugin font that loads after first paint must re-measure.
  ['plugin font remeasure', () => onPluginFontLoadsChanged(() => monaco.editor.remeasureFonts())]
])

loader.config({ monaco })

const unregisterEditorModelRegistry = editorModelRegistry.register(monaco)
if (import.meta.hot) {
  import.meta.hot.dispose(unregisterEditorModelRegistry)
}
export { monaco }
