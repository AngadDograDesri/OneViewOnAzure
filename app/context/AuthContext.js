"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if we're in PDF generation mode (skip auth check)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pdf') === 'true') {
      console.log('PDF mode detected in AuthContext - skipping auth');
      setLoading(false);
      return; // Skip auth check for PDF generation
    }

    // Check if user is logged in on mount
    const userData = localStorage.getItem('user');

    if (userData) {
      setUser(JSON.parse(userData));
    } else if (!pathname.startsWith('/login')) {
      router.push('/login');
    }

    setLoading(false);
  }, [pathname, router]);

  const logout = async () => {
    try {
      // Call API to clear the httpOnly cookie
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all auth data from localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('authToken'); // Clear this too if it exists

      // Update state
      setUser(null);

      // Redirect to login
      router.push('/login');
      router.refresh(); // Force a refresh to clear any cached data
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);