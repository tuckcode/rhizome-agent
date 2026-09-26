import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type FocusedPane = 'chat' | 'note'

/**
 * The focused window's pane switch (native audit 2026-09-26): when Chat and
 * the open note cannot both meet their minimum widths, the workspace shows
 * one of them at a time instead of compressing both.
 */
export function FocusedPaneTabs({
  value,
  noteTitle,
  onValueChange,
}: {
  value: FocusedPane
  noteTitle: string
  onValueChange: (next: FocusedPane) => void
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next === 'chat' ? 'chat' : 'note')}
      className="shrink-0 border-b border-[var(--border-subtle,var(--border))] px-3 py-1.5"
      style={{ paddingLeft: 'max(12px, var(--subhead-traffic-light-inset, 12px))' }}
      data-testid="focused-pane-tabs"
    >
      <TabsList className="h-8">
        <TabsTrigger value="chat" className="px-3 text-[12px]">Chat</TabsTrigger>
        <TabsTrigger value="note" className="min-w-0 max-w-[16rem] gap-1.5 px-3 text-[12px]" title={noteTitle}>
          Notes
          <span className="min-w-0 truncate text-muted-foreground">· {noteTitle}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
