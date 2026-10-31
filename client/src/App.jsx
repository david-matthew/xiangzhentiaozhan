import { Routes, Route } from 'react-router-dom'
import Splash from './pages/Splash'
import Landing from './pages/Landing'
import MapPage from './pages/MapPage'
import FoodMap from './pages/FoodMap'
import CyclingRoutes from './pages/CyclingRoutes'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/cycling-routes" element={<CyclingRoutes />} />
      <Route path="/challenge" element={<Landing />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/food-guide" element={<FoodMap />} />
    </Routes>
  )
}
