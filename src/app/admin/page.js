"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

if (typeof window !== 'undefined') {
  const L = require('leaflet');
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export default function AdminDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [attendances, setAttendances] = useState([]);
  const [viewMode, setViewMode] = useState('qr'); // 'qr', 'list', 'map'
  const [qrToken, setQrToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [qrLoading, setQrLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || role !== 'admin')) {
      router.push('/');
    }
  }, [user, role, loading, router]);

  const fetchNewToken = async () => {
    try {
      setQrLoading(true);
      const response = await fetch('/api/generate-qr', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to fetch QR token');
      
      const data = await response.json();
      if (data.token) {
        setQrToken(data.token);
        setTimeLeft(60);
      } else {
        throw new Error('No token in response');
      }
    } catch (error) {
      console.error('Error fetching QR token', error);
      setQrToken(''); // Clear token on error to show error UI
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (user && role === 'admin') {
      fetchNewToken();
      const interval = setInterval(() => {
        setTimeLeft(prev => {
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

  useEffect(() => {
    if (user && role === 'admin') {
      const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records = [];
        snapshot.forEach((doc) => records.push({ id: doc.id, ...doc.data() }));
        setAttendances(records);
      });
      return () => unsubscribe();
    }
  }, [user, role]);

  const toggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'verified' ? 'flagged' : 'verified';
      await updateDoc(doc(db, 'attendance', id), { status: newStatus });
    } catch (error) {
      console.error('Error updating status', error);
    }
  };

  if (loading || !user || role !== 'admin') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-main)' }}>
      Cargando dashboard...
    </div>
  );

  return (
    <div className="container">
      {/* Navbar */}
      <div className="navbar glass-panel" style={{ borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '1.5rem' }}>🔥</span>
          <h3 style={{ margin: 0 }}>Panel Administrador</h3>
        </div>
        <button onClick={() => auth.signOut()} className="secondary" style={{ padding: '0.5rem 1rem' }}>
          Cerrar Sesión
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'qr', label: '📱 QR de Estación', desc: 'Código para bomberos' },
          { id: 'list', label: '📋 Asistencias', desc: 'Registros en tiempo real' },
          { id: 'map', label: '🗺️ Mapa', desc: 'Ubicaciones' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={viewMode === tab.id ? '' : 'secondary'}
            style={{ flex: 1 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* QR Panel */}
      {viewMode === 'qr' && (
        <div className="card glass-panel animate-fade-in" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>📱 Código QR de la Estación</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Coloca esta pantalla donde los bomberos puedan escanearlo con sus celulares al llegar al turno.
            <strong style={{ color: 'var(--primary)' }}> Se renueva automáticamente cada 60 segundos</strong> para prevenir fraudes.
          </p>

          <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', display: 'inline-block', marginBottom: '1rem' }}>
            {qrLoading ? (
              <div style={{ width: 256, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontSize: '1rem' }}>
                Generando QR...
              </div>
            ) : qrToken ? (
              <QRCodeSVG value={qrToken} size={256} level="H" />
            ) : (
              <div style={{ width: 256, height: 256, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <div>⚠️</div>
                <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Error generando QR</div>
                <button onClick={fetchNewToken} style={{ marginTop: '1rem', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>Reintentar</button>
              </div>
            )}
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Expira en: <span style={{ color: timeLeft < 10 ? 'var(--danger)' : 'var(--primary)', fontWeight: 'bold', fontSize: '1.5rem' }}>{timeLeft}s</span>
            </div>
            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', marginTop: '0.5rem' }}>
              <div style={{ height: '100%', background: timeLeft < 10 ? 'var(--danger)' : 'var(--primary)', width: `${(timeLeft / 60) * 100}%`, borderRadius: '3px', transition: 'width 1s linear' }}></div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '1rem' }}>
              🔒 Cada código es único y de un solo uso. No puede reutilizarse ni compartirse.
            </p>
          </div>
        </div>
      )}

      {/* List Panel */}
      {viewMode === 'list' && (
        <div className="card glass-panel animate-fade-in" style={{ overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '1rem' }}>Asistencias en Tiempo Real ({attendances.length})</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Bombero</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Hora</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Selfie</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Estado</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map(record => (
                <tr key={record.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem' }}>{record.email}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    {record.timestamp ? record.timestamp.toDate().toLocaleString('es-ES') : 'Procesando...'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {record.selfieUrl ? (
                      <a href={record.selfieUrl} target="_blank" rel="noreferrer">
                        <img src={record.selfieUrl} alt="Selfie" style={{ width: 45, height: 45, objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--border)' }} />
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.8rem',
                      background: record.status === 'verified' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                      color: record.status === 'verified' ? 'var(--secondary)' : 'var(--danger)'
                    }}>
                      {record.status === 'verified' ? '✓ Verificado' : '⚠ Sospechoso'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <button
                      className={record.status === 'verified' ? 'danger' : 'secondary'}
                      onClick={() => toggleStatus(record.id, record.status)}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      {record.status === 'verified' ? 'Marcar Sospechoso' : 'Aprobar'}
                    </button>
                  </td>
                </tr>
              ))}
              {attendances.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay registros de asistencia todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Map Panel */}
      {viewMode === 'map' && (
        <div className="card glass-panel animate-fade-in" style={{ padding: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Mapa de Check-ins</h3>
          <div style={{ height: 500 }}>
            <MapContainer center={[0, 0]} zoom={2} style={{ height: '100%', borderRadius: 'var(--radius)' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {attendances.filter(r => r.location).map(record => (
                <Marker key={record.id} position={[record.location.lat, record.location.lng]}>
                  <Popup>
                    <div>
                      <strong>{record.email}</strong><br />
                      {record.timestamp?.toDate().toLocaleString('es-ES')}<br />
                      <span style={{ color: record.status === 'verified' ? 'green' : 'red' }}>
                        {record.status === 'verified' ? '✓ Verificado' : '⚠ Sospechoso'}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}
