import modCards from './modCards'
import nullCards from './nullCards'
import gear from './gear'
import events from './events'
import type { Card } from '../../domain/decks/DeckEngine'

export const Handbook = {
  modCards,
  nullCards,
  gear,
  events,
  getAllCards(): Card[] {
    return [...modCards, ...nullCards]
  }
}

export default Handbook
