"use client";
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';

export default function StationQRPage() {
  const [token, setToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [qrLoading, setQrLoading] = useState(true);
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || role !== 'admin')) {
      router.push('/');
    }
  }, [user, role, loading, router]);

  const fetchNewToken = async () => {
    try {
      setQrLoading(true);
      const response = await fetch('/api/generate-qr', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to fetch token');
      
      const data = await response.json();
      if (data.token) {
        setToken(data.token);
        setTimeLeft(60); // Reset timer
      } else {
        throw new Error('No token in response');
      }
    } catch (error) {
      console.error('Error fetching QR token', error);
      setToken('');
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (user && role === 'admin') {
      fetchNewToken();
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            fetchNewToken();
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [user, role]);

  if (loading || !user || role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-main)' }}>
        Cargando estación...
      </div>
    );
  }

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card glass-panel animate-fade-in" style={{ textAlign: 'center', maxWidth: '600px', width: '100%' }}>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span style={{ fontSize: '1.5rem' }}>📱</span>
          <h2 style={{ margin: 0 }}>Código QR de la Estación</h2>
        </div>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Coloca esta pantalla donde los bomberos puedan escanearlo con sus celulares al llegar al turno.
          <strong style={{ color: 'var(--primary)' }}> Se renueva automáticamente cada 60 segundos</strong> para prevenir fraudes.
        </p>
        
        <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', display: 'inline-block', marginBottom: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {qrLoading ? (
            <div style={{ width: 256, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontSize: '1rem' }}>
              Generando QR...
            </div>
          ) : token ? (
            <QRCodeSVG value={token} size={256} level="H" />
          ) : (
            <div style={{ width: 256, height: 256, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
              <div style={{ fontSize: '0.875rem' }}>Error generando QR</div>
              <button onClick={fetchNewToken} className="secondary" style={{ marginTop: '1rem', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>Reintentar</button>
            </div>
          )}
        </div>
        
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            Expira en: <span style={{ color: timeLeft < 10 ? 'var(--danger)' : 'var(--primary)', fontWeight: 'bold', fontSize: '1.5rem' }}>{timeLeft}s</span>
          </div>
          <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              background: timeLeft < 10 ? 'var(--danger)' : 'var(--primary)', 
              width: `${(timeLeft / 60) * 100}%`, 
              borderRadius: '3px', 
              transition: 'width 1s linear' 
            }}></div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '1.5rem' }}>
            🔒 Cada código es único y de un solo uso. No puede reutilizarse ni compartirse.
          </p>
        </div>

        <button 
          onClick={() => auth.signOut()} 
          className="secondary" 
          style={{ marginTop: '2rem', width: '100%' }}
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
