"use client";
import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      if (role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/check-in');
      }
    }
  }, [user, role, authLoading, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!auth) {
      setError('Error del sistema: Faltan las variables de entorno de Firebase en Vercel.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Let the useEffect handle redirection
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="auth-wrapper"><div className="card text-center">Loading...</div></div>;

  return (
    <div className="auth-wrapper">
      <div className="card auth-card animate-fade-in glass-panel">
        <h2 className="text-center mb-4">Firefighter Portal</h2>
        <p className="text-center text-muted mb-4">Secure Authentication Required</p>
        
        {error && <div className="text-center mb-4" style={{color: 'var(--danger)'}}>{error}</div>}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="user@firedept.com"
              required 
            />
          </div>
          <div>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>
          <button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
