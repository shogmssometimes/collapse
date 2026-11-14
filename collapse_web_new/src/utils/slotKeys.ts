// Slot 1 reuses existing legacy keys so old saves are preserved automatically.
export const deckBuilderKey = (slot: number): string =>
  slot === 1 ? 'collapse.deck-builder.v2' : `collapse.deck-builder.slot.${slot}`

export const CHAR_ACTIVE_KEY = 'collapse.char.active'

export const charSlotKey = (slot: number): string => `collapse.char.slot.${slot}`

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

// Added for B2 (per-slot isolation): Grit/Collapse (held inside the CS
// Matrix's saved graph), the shared notifications queue, the CC wallet,
// the Set Rolls/"status rows" widget, Combat's chip-desync flag, and the
// Method panel's hide-unused-(0) toggle were all previously stored under a
// single global key shared by every slot — switching slots left them
// untouched instead of swapping in that slot's own values. Slot 1 reuses
// the legacy un-suffixed key so existing saves keep working.
export const csmatrixKey = (slot: number): string =>
  slot === 1 ? 'csmatrix.graph' : `csmatrix.graph.slot.${slot}`

export const notificationsKey = (slot: number): string =>
  slot === 1 ? 'chud.notifications.v1' : `chud.notifications.slot.${slot}`

export const walletKey = (slot: number): string =>
  slot === 1 ? 'chud.wallet' : `chud.wallet.slot.${slot}`

export const statusRollsKey = (slot: number): string =>
  slot === 1 ? 'chud.statusRolls' : `chud.statusRolls.slot.${slot}`

export const combatKey = (slot: number): string =>
  slot === 1 ? 'combat.v1' : `combat.slot.${slot}`

export const hideUnusedMethodsKey = (slot: number): string =>
  slot === 1 ? 'chud.hideUnusedMethods' : `chud.hideUnusedMethods.slot.${slot}`
