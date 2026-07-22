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

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

interface RawGear { units: number; name: string; effect: string }

const rawGear: RawGear[] = [
  { units: 1, name: "Caffeine", effect: "Vigor Roll +1" },
  { units: 1, name: "HP STIM", effect: "HP +2" },
  { units: 1, name: "Defib", effect: "Revive Downed Target" },
  { units: 1, name: "CC's/Credits", effect: "Money" },
  { units: 1, name: "Pocket Ace", effect: "Draw +1 Engram" },
  { units: 1, name: "Something Convincing", effect: "Personality Roll +1" },
  { units: 1, name: "DataShard", effect: "Inference Roll +1" },
  { units: 4, name: "NanoCamo", effect: "Become Hidden" },
  { units: 1, name: "Duct Tape", effect: "Repair - Restore Durability Dice until end of combat" },
  { units: 1, name: "Boost", effect: "Add 1d4 to roll" },
  { units: 1, name: "Stacker", effect: "Add 4 Viv" },
  { units: 3, name: "Smoke Bombs", effect: "Attacker ReRolls" },
  { units: 2, name: "Caffeine+", effect: "Vigor Roll +2" },
  { units: 2, name: "Stim+", effect: "HP +4" },
  { units: 3, name: "Pocket Ace+", effect: "Draw +2 Engrams" },
  { units: 2, name: "Something Convincing+", effect: "Personality Roll +2" },
  { units: 2, name: "DataShard+", effect: "Inference Roll +2" },
  { units: 4, name: "Warp", effect: "Change Zones" },
  { units: 3, name: "Duct Tape+", effect: "Repair - Restore Durability Dice" },
  { units: 4, name: "Antiobios", effect: "Remove Status Effect from Target, can be self" },
  { units: 4, name: "NanoCamo+", effect: "Party in Zone is Hidden" },
  { units: 5, name: "Defib+", effect: "Revive All Downed Party members in Zone" },
  { units: 3, name: "Ping", effect: "Anyone using Hidden Movement in your zone must make a Save to remain Hidden" },
  { units: 2, name: "More Ammo", effect: "Increase Hand Draw by +2 until End of Combat" },
  { units: 1, name: "Stabilizer", effect: "Increase Max Inventory by +2 until Full Rest. When you finish your rest, you lose the effect of the Stabilizer" },
  { units: 1, name: "Eye Drops", effect: "Perception Roll +1" },
  { units: 2, name: "Snake Eyes", effect: "Reroll up to 2 Damage Die" },
  { units: 1, name: "BrightPick", effect: "See in the Dark/Night Vision" },
  { units: 1, name: "Heal-at-Home", effect: "HP +1d4" },
  { units: 4, name: "Heal-the-Home", effect: "HP +1d10, distributed through your Zone as you wish" },
  { units: 2, name: "HackPick", effect: "Auto-Pass a Hack" },
  { units: 2, name: "DoorPick", effect: "Auto-Pass a Lock" },
  { units: 2, name: "LaserMic", effect: "Auto-Pass a Hearing Related Perception Check" },
  { units: 1, name: "MUSCLE STIM", effect: "Force Approach +1" },
  { units: 1, name: "SLICK", effect: "Finesse Approach +1" },
  { units: 1, name: "PREBIOS", effect: "Guts Approach +1" },
  { units: 1, name: "MNEMO TABS", effect: "Logic Approach +1" },
  { units: 1, name: "SHINE", effect: "Show Approach +1" },
  { units: 1, name: "SILVER TABS", effect: "Tell Approach +1" },
  { units: 4, name: "SOMASAVER", effect: "Must be same zone as target; used after revive but before Collapse roll; Prevent 1 Collapse for revived Target; does not revive or heal collapse [Expensive]" },
  { units: 4, name: "Flash Shield", effect: "Lasts until start of next turn; Increase WT by +1 [Expensive]" },
  { units: 2, name: "Charm Powder", effect: "Breathed/ingested/skin contact; Target becomes Charmed [Expensive]" },
  { units: 2, name: "MotionZip", effect: "Personal ping; prevents advantage from single Flanked strike targeting you; lasts until start of next turn or after preventing flanking" },
  { units: 3, name: "RemoteHack", effect: "Auto-Pass a Hack, from a distance" },
  { units: 3, name: "RemotePick", effect: "Auto-Pass a Lock, from a distance" },
  { units: 3, name: "RemoteMic", effect: "Auto-Pass a Hearing Related Perception Check, from a distance" },
  { units: 3, name: "RemoteCamSight", effect: "Auto-Pass a Vision Related Perception Check, from a distance" },
  { units: 2, name: "CamSight", effect: "Auto-Pass a Vision Related Perception Check" },
  { units: 2, name: "SprayArmor", effect: "Viv +1d4" },
  { units: 2, name: "Marker", effect: "Target cannot become hidden; you are aware of their movements" },
  { units: 3, name: "Picker", effect: "Restore 1 Engram of your choice" },
  { units: 3, name: "Cycler", effect: "Place the top card of your deck at the bottom" },
  { units: 1, name: "Shuffler", effect: "Shuffle Engram Deck" },
  { units: 1, name: "RopeCord", effect: "Rope/Paracord" },
  { units: 1, name: "Restraints", effect: "Target receives Bound Status Effect" },
  { units: 2, name: "LightDrone", effect: "Illuminate a Zone" },
  { units: 3, name: "pinchEMP", effect: "Disable all electronics within the Zone" },
  { units: 5, name: "burstEMP", effect: "Disable all electronics in a large area" },
  { units: 2, name: "Grenade", effect: "Everyone in Zone makes 1d10 defense roll vs PCDC 4; fail=2 damage, pass=0" },
  { units: 4, name: "Plastic Explosive", effect: "Everyone in Zone makes roll vs PCDC 7; fail=6 damage, pass=2" },
  { units: 4, name: "Remote Qover", effect: "Deploy Qover to another Zone; +2 to defense rolls for those near Qover, max 2; Flanking reduces advantage until moving behind cover again" },
  { units: 3, name: "Qover", effect: "Deploy Qover; +2 to defense rolls for those near, up to 2; Flanking reduces advantage until moving behind cover again" },
  { units: 2, name: "GanoCamo", effect: "Become visually Hidden from organic entities" },
  { units: 2, name: "ChromeCamo", effect: "Become visually Hidden from Technological Entities" },
  { units: 3, name: "RemoteAntiBios", effect: "Remove Status Effect from Target, from a distance" },
  { units: 4, name: "BlanketBios", effect: "Remove Status Effects from the Zone" },
  { units: 5, name: "RemoteBlanketBios", effect: "Remove Status Effects from the Zone, from a distance" },
  { units: 4, name: "BoneDust", effect: "Add +1 Grit" },
]

export const gear: GearItem[] = rawGear.map((item) => ({
  id: `gear-${slugify(item.name)}`,
  name: item.name,
  slot: 'Misc',
  rarity: 'Common',
  description: item.effect,
  effect: item.effect,
  cost: item.units,
}))

export default gear
