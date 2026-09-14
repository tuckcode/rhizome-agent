import { describe, expect, it } from 'vitest'
import {
  COMMAND_RAIL_EXPANDED_WIDTH_PX,
  COMMAND_RAIL_TRAFFIC_LIGHT_INSET,
  COMMAND_RAIL_WIDTH_PX,
  MACOS_TRAFFIC_LIGHT_POSITION,
} from './trafficLights'

describe('trafficLights leftover geometry', () => {
  it('locks collapsed command rail width', () => {
    expect(COMMAND_RAIL_WIDTH_PX).toBe(46)
  })

  it('locks expanded command rail width', () => {
    expect(COMMAND_RAIL_EXPANDED_WIDTH_PX).toBe(240)
  })

  it('locks sessions-column vertical inset below macOS traffic lights', () => {
    expect(COMMAND_RAIL_TRAFFIC_LIGHT_INSET).toBe(
      MACOS_TRAFFIC_LIGHT_POSITION.y + 43,
    )
  })
})
