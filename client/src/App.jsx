import { Routes, Route } from 'react-router-dom'
import Splash from './pages/Splash'
import Landing from './pages/Landing'
import MapPage from './pages/MapPage'
import FoodMap from './pages/FoodMap'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/challenge" element={<Landing />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/food-guide" element={<FoodMap />} />
    </Routes>
  )
}
