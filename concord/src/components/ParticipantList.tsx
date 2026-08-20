import type { Participant } from '../types/call'

type Props = {
  participants: Participant[]
}

export default function ParticipantList({ participants }: Props) {
  return (
    <div className="participant-list">
      <span className="participant-list-title">Participantes ({participants.length})</span>
      <ul>
        {participants.map((p) => (
          <li key={p.id} className={p.speaking ? 'speaking' : ''}>
            <span className="participant-dot" />
            {p.name}
            {p.isLocal ? ' (você)' : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
