import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './CyclingRoutes.css'

const komoot = (id, token) =>
  `https://www.komoot.com/tour/${id}/embed?share_token=${token}&layout=compact&line=8879e1`

const REGIONS = [
  {
    name: 'Northern Taiwan',
    maps: [
      komoot('3188213726', 'ar1hG55iNWc8rKZQcvNjymvo511UBu5wvqk6kVIJehAOe10EWi'),
      komoot('3189542573', 'aDTOFFrf2buoZjGZLkB8lZsCFIvTiJL2qG6TnX3bZaizNb4KSb'),
      komoot('3190851452', 'a7NGnEgtogf512VUXv1OSQCrIaII1pwjnqONmH81gInnZFISvI'),
      komoot('3190868784', 'aOeHiJ3FlE4PMyuDVFjI0t1iFZmyIAEeUqQ1joxGn9LWqP3u5L'),
      komoot('3190889292', 'azmjTcnrpwo8640S20E7rRVlIymiZjFSRpsPgHGE4e8buK7iuf'),
      komoot('3190921909', 'awHW2b05iOFm8rj807n8j4tZ0WTKSjPyCGy7RU2PuR7VQCPh6G'),
      komoot('3195904152', 'akN5ZVMRTrPEInCwrazAwNO18H57effV7EheQuq9mLD1mMCEJ6'),
    ],
  },
  { name: 'Central Taiwan', maps: [] },
  { name: 'Southern Taiwan', maps: [] },
  { name: 'Eastern Taiwan', maps: [] },
]

export default function CyclingRoutes() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'The Best Cycling Routes in Taiwan'
  }, [])

  return (
    <div className="cr-page">
      <div className="cr-content">
        <button className="cr-back" onClick={() => navigate('/')}>← Back</button>
        <h1 className="cr-title">The Best Cycling Routes in Taiwan</h1>
        <p className="cr-subtitle">One day rides from every major city in Taiwan</p>

        {REGIONS.map(({ name, maps }) => (
          <section key={name} className="cr-region">
            <h2>{name}</h2>
            {maps.length === 0 ? (
              <p className="cr-soon">Coming soon</p>
            ) : (
              <div className="cr-maps">
                {maps.map((src, i) => (
                  <iframe
                    key={src}
                    title={`${name} route ${i + 1}`}
                    src={src}
                    width="100%"
                    height="260"
                    frameBorder="0"
                    scrolling="no"
                    allow="fullscreen"
                    allowFullScreen
                    loading="lazy"
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
