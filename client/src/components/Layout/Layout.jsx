import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { InfluencerProvider } from '../../context/InfluencerContext';

export default function Layout() {
  return (
    <InfluencerProvider>
      <div className="flex h-screen bg-cream-100 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </InfluencerProvider>
  );
}
