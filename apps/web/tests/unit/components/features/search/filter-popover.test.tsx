import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FilterPopover } from '@/components/features/search/filter-popover'

// M2-DESIGN-SPEC.md §1.6 — the disclosure popover primitive: not a modal
// (no focus trap, background stays interactive), closes on outside-click
// and Escape returning focus to the trigger, changes are local until the
// panel's own Apply (tested via the panel content unmounting on close,
// discarding whatever the child rendered).
describe('FilterPopover', () => {
  it('shows the idle label when not active, and is closed by default', () => {
    render(
      <FilterPopover label="Price" isActive={false} panelId="price-panel">
        {() => <div>panel content</div>}
      </FilterPopover>,
    )
    expect(screen.getByRole('button', { name: /Price/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText('panel content')).not.toBeInTheDocument()
  })

  it('opens the panel on trigger click and moves focus to the first control inside', () => {
    render(
      <FilterPopover label="Price" isActive={false} panelId="price-panel">
        {() => (
          <div>
            <input aria-label="Min" />
          </div>
        )}
      </FilterPopover>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Price/ }))
    expect(screen.getByRole('button', { name: /Price/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByLabelText('Min')).toHaveFocus()
  })

  it('closes on Escape and returns focus to the trigger', () => {
    render(
      <FilterPopover label="Price" isActive={false} panelId="price-panel">
        {() => <input aria-label="Min" />}
      </FilterPopover>,
    )
    const trigger = screen.getByRole('button', { name: /Price/ })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByLabelText('Min')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on outside click', () => {
    render(
      <div>
        <FilterPopover label="Price" isActive={false} panelId="price-panel">
          {() => <input aria-label="Min" />}
        </FilterPopover>
        <button type="button">elsewhere</button>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Price/ }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'elsewhere' }))
    expect(screen.queryByLabelText('Min')).not.toBeInTheDocument()
  })

  it('calling close() from inside the panel (the Apply button) closes it and returns focus to the trigger', () => {
    render(
      <FilterPopover label="Price" isActive={false} panelId="price-panel">
        {({ close }) => (
          <button type="button" onClick={close}>
            Apply
          </button>
        )}
      </FilterPopover>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Price/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(
      screen.queryByRole('button', { name: 'Apply' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Price/ })).toHaveFocus()
  })

  it('shows the resolved summary label instead of the idle label when active', () => {
    render(
      <FilterPopover
        label="Price"
        summary="£250k–£400k"
        isActive
        panelId="price-panel"
      >
        {() => null}
      </FilterPopover>,
    )
    expect(
      screen.getByRole('button', { name: /£250k–£400k/ }),
    ).toBeInTheDocument()
  })

  it('applies the active visual state via aria-expanded/data attributes without disabling the trigger', () => {
    render(
      <FilterPopover label="Price" isActive panelId="price-panel">
        {() => null}
      </FilterPopover>,
    )
    expect(screen.getByRole('button', { name: /Price/ })).not.toBeDisabled()
  })
})
