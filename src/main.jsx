import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css' // Импортируем ВАШИ стили

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode> {/* УДАЛЕНО */}
    <App />
  // </React.StrictMode>, {/* УДАЛЕНО */}
)