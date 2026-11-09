export type GearRarity = 'Common' | 'Uncommon' | 'Rare' | 'Unique'
export type GearSlot = 'Head' | 'Body' | 'Hands' | 'Feet' | 'Accessory' | 'Weapon' | 'Misc'
export type GearCategory = 'Utility' | 'Field' | 'Support' | 'Tonic'

export interface GearItem {
  id: string
  name: string
  slot: GearSlot
  rarity: GearRarity
  category: GearCategory
  description?: string
  effect?: string
  tiedTo?: string
  notes?: string
  cost?: number | string
}

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

interface RawGear {
  units: number
  name: string
  category: GearCategory
  tiedTo?: string
  description?: string
  effect: string
  notes?: string
}

const rawGear: RawGear[] = [
  // --- Utility ---
  { units: 1, name: "Utility Harness", category: 'Utility', description: "Extra straps and pouches", effect: "Max Inventory +2 until full rest. Doesn't stack." },
  { units: 1, name: "Snake Eyes", category: 'Utility', effect: "After a Severity roll you make, reroll up to 2 of your Wound dice. Keep the new results." },
  { units: 1, name: "Night Vision", category: 'Utility', effect: "See in the dark." },
  { units: 1, name: "Marker", category: 'Utility', tiedTo: "Inference", description: "Tag that follows a target", effect: "Apply Marked as the Engram would, adding 1d4." },
  { units: 2, name: "Skeleton Key", category: 'Utility', description: "Opens any kind of lock", effect: "Auto-pass a Lock (anything opened by a key, code, or arrangement)." },
  { units: 1, name: "Restraints", category: 'Utility', tiedTo: "Vigor", effect: "Apply Bind as the Engram would, adding 1d4." },
  { units: 0, name: "RopeCord", category: 'Utility', description: "Rope or paracord", effect: "Narrative item, no mechanical effect." },
  { units: 1, name: "Cutters", category: 'Utility', effect: "Remove Bound from yourself or a target in your zone." },
  { units: 1, name: "Second Wind", category: 'Utility', description: "Another shot at shaking an effect", effect: "Make one extra save against a Set on you.", notes: "Normally an extra save costs your non movement action." },
  { units: 3, name: "Rest Kit", category: 'Utility', effect: "On a short rest, you and your party each choose two options instead of one. You can't pick the same option twice. [Expensive]" },

  // --- Field ---
  { units: 2, name: "Camouflage", category: 'Field', tiedTo: "Hidden Methods", effect: "Enter Hidden movement (auto-succeeds). +1d4 to your Hidden set." },
  { units: 2, name: "Adrenaline Shot", category: 'Field', tiedTo: "Reckless Methods", description: "Reckless counterpart to Camouflage", effect: "Enter Reckless movement (auto-succeeds). +1d4 to your Reckless set." },
  { units: 2, name: "Sweep", category: 'Field', tiedTo: "Any Method", description: "Free search on the whole zone", effect: "Make a free Search roll against every Hidden creature's Set in your zone (you choose which). Beat a Set and that creature is spotted: it loses Hidden movement and enters Exposed movement. Each Set you fail to beat decays as normal.", notes: "Roll any Method. Saves your non movement action." },
  { units: 2, name: "Snare", category: 'Field', tiedTo: "Any Method", description: "Free stop attempt on the whole zone", effect: "Make a free Stop attempt against every Reckless creature's Set in your zone (you choose which). Beat a Set and that creature loses Reckless and enters Exposed movement. Each Set you fail to beat decays as normal.", notes: "Roll any Method. Stopping a Reckless mover is normally a Roleplay action." },
  { units: 1, name: "Jinx", category: 'Field', description: "Curse an enemy's damage roll", effect: "When an enemy makes a Severity roll against you, reroll up to 2 of its Wound dice and keep the lower of each pair. Use before wounds are counted." },
  { units: 3, name: "Smoke Bombs", category: 'Field', effect: "Fill the zone with smoke for 1d4 turns. All attackers roll two dice on strikes and take the lower." },
  { units: 2, name: "Ward Charge", category: 'Field', effect: "Increase your WT by +1 until the start of your next turn. [Expensive]" },
  { units: 2, name: "Charm Powder", category: 'Field', tiedTo: "Personality", effect: "Apply Charm as the Engram would, adding 1d4. Must be breathed in, ingested, or placed on skin. [Expensive]" },
  { units: 2, name: "Improvised Explosive", category: 'Field', effect: "Everyone in the zone defends vs DC 15. Fail: 3 wounds. Pass: 1." },
  { units: 4, name: "Breaching Charge", category: 'Field', effect: "Everyone in the zone rolls vs DC 20. Fail: 6 wounds. Pass: 2." },

  // --- Support ---
  { units: 1, name: "Field Dressing", category: 'Support', effect: "HP +4." },
  { units: 2, name: "Triage Kit", category: 'Support', description: "Area first aid for the zone", effect: "HP +8, distributed through your zone as you wish." },
  { units: 2, name: "Revive Kit", category: 'Support', effect: "Revive a downed target at 1 HP. They roll Collapse as normal." },
  { units: 4, name: "Lifeline", category: 'Support', description: "Top-tier revive", effect: "Revive a downed target in your zone at 1 HP and skip their Collapse roll. [Expensive]" },
  { units: 1, name: "Pocket Ace", category: 'Support', effect: "Restore 1 Engram." },
  { units: 1, name: "Whetstone", category: 'Support', description: "Hones a blade or blunt enhancer", effect: "Restore Sync.", notes: "Resync normally costs an action." },
  { units: 1, name: "Reload", category: 'Support', description: "Reloads a ranged enhancer", effect: "Restore Sync.", notes: "Resync normally costs an action." },
  { units: 2, name: "Grit Draught", category: 'Support', effect: "Add +1 Grit." },
  { units: 3, name: "Antidote", category: 'Support', effect: "Remove a status effect from any target." },

  // --- Tonic ---
  { units: 1, name: "Boost", category: 'Tonic', effect: "Before an AO roll, add 1d6 to it." },
  { units: 2, name: "Smelling Salts", category: 'Tonic', effect: "Free Overload: after you roll a Method, double any number of dice. None are discarded." },
  { units: 1, name: "Jump Start", category: 'Tonic', effect: "Add 1d4 to your Readiness roll." },
  { units: 1, name: "Force Tonic", category: 'Tonic', tiedTo: "Force", effect: "Force Method +1 die on your next roll with it. The pool can pass 6 temporarily." },
  { units: 1, name: "Finesse Tonic", category: 'Tonic', tiedTo: "Finesse", effect: "Finesse Method +1 die on your next roll with it. The pool can pass 6 temporarily." },
  { units: 1, name: "Guts Tonic", category: 'Tonic', tiedTo: "Guts", effect: "Guts Method +1 die on your next roll with it. The pool can pass 6 temporarily." },
  { units: 1, name: "Logic Tonic", category: 'Tonic', tiedTo: "Logic", effect: "Logic Method +1 die on your next roll with it. The pool can pass 6 temporarily." },
  { units: 1, name: "Show Tonic", category: 'Tonic', tiedTo: "Show", effect: "Show Method +1 die on your next roll with it. The pool can pass 6 temporarily." },
  { units: 1, name: "Tell Tonic", category: 'Tonic', tiedTo: "Tell", effect: "Tell Method +1 die on your next roll with it. The pool can pass 6 temporarily." },
]

export const gear: GearItem[] = rawGear.map((item) => ({
  id: `gear-${slugify(item.name)}`,
  name: item.name,
  slot: 'Misc',
  rarity: 'Common',
  category: item.category,
  description: item.description,
  effect: item.effect,
  tiedTo: item.tiedTo,
  notes: item.notes,
  cost: item.units,
}))

export default gear
