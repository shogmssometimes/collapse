import HoldButton from './HoldButton'

type ReshuffleButtonProps = {
  onReshuffle: () => void
}

// Long-press button: holding it down fires onReshuffle. See HoldButton for
// the shared long-press + visual fill behavior.
export default function ReshuffleButton({ onReshuffle }: ReshuffleButtonProps) {
  return <HoldButton label="Reshuffle" onHold={onReshuffle} />
}

