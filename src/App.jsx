// src/App.jsx
import { useState } from 'react';
import Header from './components/Header.jsx';

export default function App() {
  const [query, setQuery] = useState('');

  return (
    <div className="min-h-screen bg-neutral-50 text-gray-900">
      <Header />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
          Welcome to KART AI. Start building your search and results UI here.
        </div>
      </main>
    </div>
  );
}