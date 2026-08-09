import type { ComponentType, SVGAttributes } from 'react'
import {
  ArrowsClockwise,
  CalendarBlank,
  FileText,
  Flask,
  StackSimple,
  Tag,
  Target,
  Users,
  Wrench,
} from '@phosphor-icons/react'
import { resolveIcon } from '../../utils/iconRegistry'

const TYPE_ICON_MAP: Record<string, ComponentType<SVGAttributes<SVGSVGElement>>> = {
  Project: Wrench,
  project: Wrench,
  Experiment: Flask,
  experiment: Flask,
  Responsibility: Target,
  responsibility: Target,
  Procedure: ArrowsClockwise,
  procedure: ArrowsClockwise,
  Person: Users,
  person: Users,
  Event: CalendarBlank,
  event: CalendarBlank,
  Topic: Tag,
  topic: Tag,
  Type: StackSimple,
  type: StackSimple,
}

export function getTypeIcon(isA: string | null, customIcon?: string | null): ComponentType<SVGAttributes<SVGSVGElement>> {
  if (customIcon) return resolveIcon(customIcon)
  return (isA && (Reflect.get(TYPE_ICON_MAP, isA) as ComponentType<SVGAttributes<SVGSVGElement>> | undefined)) || FileText
}
