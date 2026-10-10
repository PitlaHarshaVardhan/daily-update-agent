import { describe, expect, it } from 'vitest'
import { DailyAssetSnapshot } from '../src/types'
import { assessDailyMovement } from '../src/lib/market-intelligence'

const snapshot: DailyAssetSnapshot = {
  id: 'test-stock',
  name: 'Test Company',
  assetType: 'equity',
  symbol: 'TEST',
  exchange: 'NSE',
  price: 100,
  currency: 'INR',
  dailyChangePercent: 0,
  fiveSessionChangePercent: 0,
  asOf: '2026-10-09T10:00:00.000Z',
  source: 'Test feed',
  freshness: 'eod',
}

describe('assessDailyMovement', () => {
  it('marks positive daily and five-session moves as bullish momentum', () => {
    const assessment = assessDailyMovement({ ...snapshot, dailyChangePercent: 1.2, fiveSessionChangePercent: 2.4 }, [])

    expect(assessment.signal).toBe('BULLISH_MOMENTUM')
    expect(assessment.bullishReasons).toHaveLength(2)
    expect(assessment.suggestion).toContain('not a personalized buy instruction')
  })

  it('marks negative moves and matched risk headlines as bearish evidence', () => {
    const assessment = assessDailyMovement({ ...snapshot, dailyChangePercent: -1, fiveSessionChangePercent: -2 }, ['Company reports quarterly loss'])

    expect(assessment.signal).toBe('BEARISH_MOMENTUM')
    expect(assessment.bearishReasons).toHaveLength(3)
  })

  it('keeps conflicting day and week moves mixed', () => {
    const assessment = assessDailyMovement({ ...snapshot, dailyChangePercent: 0.5, fiveSessionChangePercent: -0.2 }, [])

    expect(assessment.signal).toBe('MIXED')
    expect(assessment.bullishReasons).toHaveLength(1)
    expect(assessment.bearishReasons).toHaveLength(1)
  })
})