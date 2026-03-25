import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CaseFlowApp from './CaseFlowApp';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CaseFlowApp />
    </BrowserRouter>
  </React.StrictMode>,
);

