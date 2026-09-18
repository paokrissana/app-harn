/**
 * The journey engine: a shared ride split by where people got out.
 *
 * Framework independent — no React, no UI, pure functions only.
 *
 * **Why this is not a `Bill`.** `shared/lib/bill.ts` splits items between a
 * fixed set of people: an item is shared by whoever is named on it, and nothing
 * about the model changes over the course of the bill. A journey is the
 * opposite — the same fare is shared by three people at the start and by one at
 * the end, and the only way to know who owes what is to walk the meter in
 * order. Sequence is the whole model, and `Bill` has no notion of it. Forcing
 * one into the other would mean inventing a synthetic item per segment and
 * losing the segment breakdown, which is the part that makes the answer
 * checkable.
 *
 * Nothing here is taxi-specific. A meter reading is just a running total, so
 * the same engine covers a ride-hailing fare, a van, or anything else that
 * accumulates as people come and go.
 */

/** Somebody on the ride. */
export interface Passenger {
  id: string
  name: string
}

/** Somebody leaving, and what the meter said when they did. */
export interface Drop {
  passengerId: string
  meter: number
}

/**
 * How a fee is divided.
 *
 * `everyone` — among all who rode at any point. A toll on the way, an airport
 * surcharge on the booking.
 * `remaining` — among those still aboard at the end. Parking at the
 * destination, which the people who left earlier never used.
 *
 * The spec allows for a fee pinned to a meter reading, dividing among whoever
 * was aboard at that moment. Left out on purpose: it costs an extra input on
 * every fee to express something these two already cover between them.
 */
export type FeeSplit = 'everyone' | 'remaining'

export interface JourneyFee {
  id: string
  label: string
  amount: number
  split: FeeSplit
}

export interface Journey {
  passengers: Passenger[]
  /** What the meter read before anybody moved. */
  startMeter: number
  /** Who left and when, in the order they left. */
  drops: Drop[]
  /** What the meter read at the final destination. */
  endMeter: number
  fees: JourneyFee[]
  /** Who settled with the driver; everyone else owes them. */
  payerId: string
}

/** One stretch of the ride, and who was in the car for it. */
export interface Segment {
  /** Meter at the start of the stretch. */
  from: number
  /** Meter at the end of it. */
  to: number
  /** What the meter added over the stretch. */
  fare: number
  /** Who was aboard, in the order they were listed. */
  aboard: string[]
  /** What the stretch cost each of them. */
  each: number
}

export interface PassengerTotal {
  passengerId: string
  /** Their share of the meter, across every stretch they were aboard for. */
  fare: number
  /** Their share of the tolls and extras. */
  fees: number
  /**
   * What they owe. Whole Baht for everyone but the payer, who carries the odd
   * change so the shares still add up to the real fare.
   */
  total: number
}

export interface Transfer {
  from: string
  to: string
  amount: number
}

export interface JourneyResult {
  /** End meter less start meter — what the driver's meter actually added. */
  meterFare: number
  feesTotal: number
  grandTotal: number
  segments: Segment[]
  passengers: PassengerTotal[]
  transfers: Transfer[]
}

/**
 * Every meter reading the journey passes through, in order: the start, each
 * drop, then the end.
 */
function meterPoints(journey: Journey): number[] {
  return [
    journey.startMeter,
    ...journey.drops.map((drop) => drop.meter),
    journey.endMeter,
  ]
}

/**
 * Break the ride into stretches between consecutive meter readings.
 *
 * Somebody who gets out at ฿145 pays for the stretch *ending* at 145 and
 * nothing after it — so the people aboard for stretch `k` are everyone bar the
 * first `k` to leave. A stretch where the meter did not move is kept rather
 * than dropped: two people getting out at the same place is ordinary, and a
 * zero-fare stretch says so honestly instead of hiding a step of the journey.
 */
export function segmentsOf(journey: Journey): Segment[] {
  const points = meterPoints(journey)
  const dropped = journey.drops.map((drop) => drop.passengerId)

  return points.slice(0, -1).map((from, index) => {
    const to = points[index + 1]
    const fare = Math.max(to - from, 0)

    const gone = new Set(dropped.slice(0, index))
    const aboard = journey.passengers
      .map((passenger) => passenger.id)
      .filter((id) => !gone.has(id))

    return {
      from,
      to,
      fare,
      aboard,
      each: aboard.length > 0 ? fare / aboard.length : 0,
    }
  })
}

/** What the meter added over the whole ride. */
export function meterFare(journey: Journey): number {
  return Math.max(journey.endMeter - journey.startMeter, 0)
}

/** Who is still in the car at the destination. */
export function stillAboard(journey: Journey): string[] {
  const gone = new Set(journey.drops.map((drop) => drop.passengerId))
  return journey.passengers
    .map((passenger) => passenger.id)
    .filter((id) => !gone.has(id))
}

/** One person's share of the meter, added up across the stretches they rode. */
export function fareFor(passengerId: string, segments: Segment[]): number {
  return segments.reduce(
    (sum, segment) =>
      segment.aboard.includes(passengerId) ? sum + segment.each : sum,
    0,
  )
}

/**
 * Work out what everyone owes and who transfers what to whom.
 *
 * Non-payers are rounded to whole Baht — nobody transfers satang — and the
 * payer absorbs the difference, so the shares always sum to the real fare. The
 * same rule the bill engine uses, for the same reason.
 */
export function calculateJourney(journey: Journey): JourneyResult {
  const { passengers, fees, payerId } = journey

  const segments = segmentsOf(journey)
  const fare = meterFare(journey)
  const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0)
  const grandTotal = fare + feesTotal

  if (passengers.length === 0) {
    return {
      meterFare: fare,
      feesTotal,
      grandTotal,
      segments,
      passengers: [],
      transfers: [],
    }
  }

  const remaining = stillAboard(journey)

  const exact = passengers.map((passenger) => {
    const feeShare = fees.reduce((sum, fee) => {
      const sharers =
        fee.split === 'remaining' ? remaining : passengers.map((p) => p.id)

      if (sharers.length === 0 || !sharers.includes(passenger.id)) return sum
      return sum + fee.amount / sharers.length
    }, 0)

    const fareShare = fareFor(passenger.id, segments)

    return {
      passengerId: passenger.id,
      fare: fareShare,
      fees: feeShare,
      exactTotal: fareShare + feeShare,
    }
  })

  const owedByOthers = exact
    .filter((share) => share.passengerId !== payerId)
    .reduce((sum, share) => sum + Math.round(share.exactTotal), 0)

  const totals: PassengerTotal[] = exact.map(({ exactTotal, ...share }) => ({
    ...share,
    total:
      share.passengerId === payerId
        ? grandTotal - owedByOthers
        : Math.round(exactTotal),
  }))

  const transfers: Transfer[] = totals
    .filter((share) => share.passengerId !== payerId && share.total > 0)
    .map((share) => ({
      from: share.passengerId,
      to: payerId,
      amount: share.total,
    }))

  return {
    meterFare: fare,
    feesTotal,
    grandTotal,
    segments,
    passengers: totals,
    transfers,
  }
}
