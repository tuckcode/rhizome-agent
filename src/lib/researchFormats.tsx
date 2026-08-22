import { Sparkle } from '@phosphor-icons/react'
import type { ResearchMode } from '../components/RhizomeFormatModal'

/**
 * A user-authored format as stored in `<vault>/.rhizome/research-formats.json`.
 * The instruction is the whole feature: to the research pipeline a built-in
 * format is also just one imperative sentence.
 */
export interface CustomFormat {
  id: string
  title: string
  instruction: string
}

export const CUSTOM_CATEGORY = 'custom'

/**
 * Present a saved format as a `ResearchMode` so the picker, the detail pane
 * and `onSelect` need no branch for it. The instruction doubles as the
 * description — it is the most honest summary of what the format will do,
 * because it is literally what the agent is told.
 */
export function customToResearchMode(format: CustomFormat, categoryLabel: string): ResearchMode {
  return {
    id: format.id,
    title: format.title,
    description: format.instruction,
    category: CUSTOM_CATEGORY,
    categoryLabel,
    icon: <Sparkle weight="bold" className="w-5 h-5" />,
    produces: [],
    samplePeek: {
      title: format.title,
      description: format.instruction,
      pills: [],
    },
  }
}

