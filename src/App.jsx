import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Club from './pages/Club.jsx'
import CreateClub from './pages/CreateClub.jsx'
import JoinClub from './pages/JoinClub.jsx'
import Profile from './pages/Profile.jsx'
import Login from './pages/Login.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/create" element={<CreateClub />} />
        <Route path="/join" element={<JoinClub />} />
        <Route path="/club/:clubId" element={<Club />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}