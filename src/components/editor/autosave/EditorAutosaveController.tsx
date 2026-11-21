import { useEffect } from 'react'
import { useAppStore } from '@/store/index'
import { attachEditorAutosaveController } from './editor-autosave-controller'
import { attachRestoredTabConflictScan } from '@/components/editor/external-changes/editor-restored-tab-conflict-scan.ts'

export default function EditorAutosaveController(): null {
  useEffect(() => {
    // Keep autosave and quit coordination alive across tab switches without retaining the full panel.
    const detachAutosave = attachEditorAutosaveController(useAppStore)
    // Check restored dirty tabs before any panel mounts, or autosave could overwrite offline agent edits.
    const detachConflictScan = attachRestoredTabConflictScan(useAppStore)
    return () => {
      detachAutosave()
      detachConflictScan()
    }
  }, [])

  return null
}
