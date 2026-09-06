// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders, screen } from '@/lib/testUtils/renderWithProviders'
import { fireEvent } from '@testing-library/react'
import { InsulinUsagePrompt } from './InsulinUsagePrompt'
import { insulinRatePerDay } from '@/lib/usageRate'

/**
 * The prompt that finally asks about insulin. Before it existed the catalog
 * left the rate blank (dosing is per person), nothing else filled it in, and
 * every insulin sat at 'unset': no runway, no reorder-by date, and absent from
 * the reorder list, the calendar and the risk banner. A box of test strips was
 * tracked better than the supply where running out is measured in hours.
 *
 * These assertions are mostly about the SHAPE of the question. Asking for one
 * number here would be worse than asking nothing: a rate is containers per day,
 * so a dose typed into a single field is wrong by a factor of the container.
 */
const noop = () => {}

describe('InsulinUsagePrompt', () => {
  it('asks for the two numbers a dose needs, not one', () => {
    renderWithProviders(
      <InsulinUsagePrompt id="t" dose="" container="" onDose={noop} onContainer={noop} />,
    )
    expect(screen.getByLabelText(/units a day/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/units per vial\/pen/i)).toBeInTheDocument()
  })

  it('says why it has to ask, since the app cannot work dosing out', () => {
    renderWithProviders(
      <InsulinUsagePrompt id="t" dose="" container="" onDose={noop} onContainer={noop} />,
    )
    expect(screen.getByText(/dosing is personal/i)).toBeInTheDocument()
    // Optional, not a gate: someone who does not know their pen size must still
    // be able to add the insulin.
    expect(screen.getByText(/skip this and set it later/i)).toBeInTheDocument()
  })

  it('offers the container size people actually have to look up', () => {
    // "1000" and "300" are the two numbers a user is least likely to know off
    // the top of their head, so the help text names them.
    renderWithProviders(
      <InsulinUsagePrompt id="t" dose="" container="" onDose={noop} onContainer={noop} />,
    )
    expect(screen.getByText(/1000/)).toBeInTheDocument()
    expect(screen.getByText(/300/)).toBeInTheDocument()
  })

  it('reports each field separately, so neither is read as the other', () => {
    const onDose = vi.fn()
    const onContainer = vi.fn()
    renderWithProviders(
      <InsulinUsagePrompt id="t" dose="" container="" onDose={onDose} onContainer={onContainer} />,
    )
    fireEvent.change(screen.getByLabelText(/units a day/i), { target: { value: '40' } })
    fireEvent.change(screen.getByLabelText(/units per vial\/pen/i), { target: { value: '1000' } })
    expect(onDose).toHaveBeenCalledWith('40')
    expect(onContainer).toHaveBeenCalledWith('1000')
    // And the pair means 0.04 containers a day, not 40. This is the whole reason
    // insulin does not share the single-field prompt.
    expect(insulinRatePerDay(40, 1000)).toBeCloseTo(0.04)
  })

  it('shows what the user has typed so far', () => {
    renderWithProviders(
      <InsulinUsagePrompt id="t" dose="24" container="300" onDose={noop} onContainer={noop} />,
    )
    expect(screen.getByLabelText(/units a day/i)).toHaveValue(24)
    expect(screen.getByLabelText(/units per vial\/pen/i)).toHaveValue(300)
  })

  it('gives its inputs unique ids so two prompts on a page stay labelled', () => {
    // The scan page renders this at three steps, each with its own id prefix.
    const { container } = renderWithProviders(
      <InsulinUsagePrompt id="step-a" dose="" container="" onDose={noop} onContainer={noop} />,
    )
    expect(container.querySelector('#step-a-dose')).toBeTruthy()
    expect(container.querySelector('#step-a-container')).toBeTruthy()
  })
})
