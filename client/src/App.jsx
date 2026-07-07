import { Routes, Route } from 'react-router-dom'
import Splash from './pages/Splash'
import Landing from './pages/Landing'
import MapPage from './pages/MapPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/challenge" element={<Landing />} />
      <Route path="/map" element={<MapPage />} />
    </Routes>
  )
}
