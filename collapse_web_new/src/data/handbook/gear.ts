export type GearRarity = 'Common' | 'Uncommon' | 'Rare' | 'Unique'
export type GearSlot = 'Head' | 'Body' | 'Hands' | 'Feet' | 'Accessory' | 'Weapon' | 'Misc'

export interface GearItem {
  id: string
  name: string
  slot: GearSlot
  rarity: GearRarity
  description: string
  effect?: string
  cost?: number | string
}

export const gear: GearItem[] = []

export default gear
