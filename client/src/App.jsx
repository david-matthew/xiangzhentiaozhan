import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import MapPage from './pages/MapPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/map" element={<MapPage />} />
    </Routes>
  )
}
