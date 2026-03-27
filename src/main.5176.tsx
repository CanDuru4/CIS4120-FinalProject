import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Port5176App from './port5176/Port5176App';
import './styles/global.css';
import './port5176/port5176.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Port5176App />
    </BrowserRouter>
  </React.StrictMode>,
);
