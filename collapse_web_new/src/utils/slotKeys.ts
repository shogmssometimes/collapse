// Slot 1 reuses existing legacy keys so old saves are preserved automatically.
export const deckBuilderKey = (slot: number): string =>
  slot === 1 ? 'collapse.deck-builder.v2' : `collapse.deck-builder.slot.${slot}`

export const gearSlotsKey = (slot: number): string =>
  slot === 1 ? 'gear.slots.v1' : `gear.slots.slot.${slot}`

export const wardrobeKey = (slot: number): string =>
  slot === 1 ? 'wardrobe.v1' : `wardrobe.slot.${slot}`

export const chudStateKey = (slot: number): string =>
  slot === 1 ? 'chud.state.v1' : `chud.state.slot.${slot}`

export const chudUiKey = (slot: number): string =>
  slot === 1 ? 'chud.ui.v1' : `chud.ui.slot.${slot}`

export const notesKey = (slot: number): string =>
  slot === 1 ? 'collapse.notes.v1' : `collapse.notes.slot.${slot}`

export const profileKey = (slot: number): string =>
  slot === 1 ? 'collapse.profile.v1' : `collapse.profile.slot.${slot}`
