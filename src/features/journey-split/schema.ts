import { z } from 'zod'

import type { Journey } from './journey'
import type { TranslationKey } from '@/i18n/translations'

type Translate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string

/**
 * The journey form, shaped like the ride itself: who set off, what the meter
 * read, who got out where, and what it said at the end.
 *
 * Most of the validation here is about **order**. A meter only ever goes up, so
 * a reading that goes backwards is not a matter of taste — it means a number
 * was typed wrong, and every share downstream would be quietly wrong with it.
 *
 * Validation messages are translated, so the schema is rebuilt when the
 * language changes.
 */
export function createJourneySchema(t: Translate) {
  const money = z
    .string()
    .trim()
    .min(1, t('required'))
    .refine((v) => !Number.isNaN(Number(v)), t('numbersOnly'))
    .refine((v) => Number(v) >= 0, t('cannotBeNegative'))
    .transform((v) => Number(v))

  const passengerSchema = z.object({
    id: z.string(),
    name: z.string().trim().min(1, t('required')),
  })

  const dropSchema = z.object({
    id: z.string(),
    passengerId: z.string().min(1, t('jsPickWhoLeft')),
    meter: money,
  })

  const feeSchema = z.object({
    id: z.string(),
    label: z.string().trim(),
    amount: money,
    split: z.enum(['everyone', 'remaining']),
  })

  return z
    .object({
      passengers: z.array(passengerSchema).min(2, t('jsAtLeastTwoPeople')),
      startMeter: money,
      drops: z.array(dropSchema),
      endMeter: money,
      fees: z.array(feeSchema),
      payerId: z.string(),
    })
    .superRefine((data, ctx) => {
      const ids = new Set(data.passengers.map((passenger) => passenger.id))

      // Somebody has to have settled with the driver.
      if (!data.passengers.some((p) => p.id === data.payerId)) {
        ctx.addIssue({
          code: 'custom',
          message: t('jsPayerRequired'),
          path: ['payerId'],
        })
      }

      /*
       * The meter only goes up, and each drop is checked against the one before
       * it rather than against the start — that way the message points at the
       * reading that actually broke the sequence, not at the first one.
       */
      let previous = data.startMeter
      const seen = new Set<string>()

      data.drops.forEach((drop, index) => {
        if (drop.meter < previous) {
          ctx.addIssue({
            code: 'custom',
            message: t('jsMeterWentBackwards'),
            path: ['drops', index, 'meter'],
          })
        }
        previous = Math.max(previous, drop.meter)

        if (drop.passengerId && !ids.has(drop.passengerId)) {
          ctx.addIssue({
            code: 'custom',
            message: t('jsPickWhoLeft'),
            path: ['drops', index, 'passengerId'],
          })
        }
        if (seen.has(drop.passengerId)) {
          ctx.addIssue({
            code: 'custom',
            message: t('jsAlreadyLeft'),
            path: ['drops', index, 'passengerId'],
          })
        }
        seen.add(drop.passengerId)
      })

      if (data.endMeter < previous) {
        ctx.addIssue({
          code: 'custom',
          message: t('jsEndBeforeLastDrop'),
          path: ['endMeter'],
        })
      }

      // Somebody has to reach the destination, or the journey has no end.
      if (data.drops.length >= data.passengers.length) {
        ctx.addIssue({
          code: 'custom',
          message: t('jsSomebodyMustArrive'),
          path: ['drops'],
        })
      }
    })
}

type JourneySchema = ReturnType<typeof createJourneySchema>

/** Form values — every box holds text. */
export type JourneyFormInput = z.input<JourneySchema>

/** Parsed values — numbers, ready for the engine. */
export type JourneyFormOutput = z.output<JourneySchema>

/** Map the form onto the journey model. */
export function toJourney(values: JourneyFormOutput): Journey {
  return {
    passengers: values.passengers.map((passenger) => ({
      id: passenger.id,
      name: passenger.name,
    })),
    startMeter: values.startMeter,
    drops: values.drops.map((drop) => ({
      passengerId: drop.passengerId,
      meter: drop.meter,
    })),
    endMeter: values.endMeter,
    fees: values.fees.map((fee) => ({
      id: fee.id,
      label: fee.label,
      amount: fee.amount,
      split: fee.split,
    })),
    payerId: values.payerId,
  }
}
