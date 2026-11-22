import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';
import './styles/global.css';
import { RootApp } from './app/RootApp';
import { YhtPortalApp } from './features/yht/YhtPortalApp';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {window.location.pathname === '/yht' || window.location.pathname.startsWith('/yht/') ? <YhtPortalApp /> : <RootApp />}
  </React.StrictMode>
);
