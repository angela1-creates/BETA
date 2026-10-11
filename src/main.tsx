import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './SocialApp'
import './i18n'
import './styles.css'
import { ResearchAuthProvider } from './researchAuth'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ResearchAuthProvider><App /></ResearchAuthProvider></React.StrictMode>)
