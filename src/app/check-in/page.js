"use client";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function CheckInPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: QR, 2: Location, 3: Selfie, 4: Done
  const [scannedToken, setScannedToken] = useState('');
  const [location, setLocation] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!loading && (!user || role === 'admin')) {
      router.push('/');
    }
  }, [user, role, loading, router]);

  // Step 1: QR Scanner
  useEffect(() => {
    if (step === 1 && !loading && user) {
      const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
      scanner.render(
        (decodedText) => {
          setScannedToken(decodedText);
          scanner.clear();
          setStep(2);
        },
        (error) => { /* ignore */ }
      );
      return () => {
        scanner.clear().catch(e => console.error(e));
      };
    }
  }, [step, loading, user]);

  // Step 2: Location
  useEffect(() => {
    if (step === 2) {
      setStatusMsg("Acquiring GPS location...");
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setStep(3);
          },
          (error) => {
            setStatusMsg("Error getting location: " + error.message);
          },
          { enableHighAccuracy: true }
        );
      } else {
        setStatusMsg("Geolocation not supported by this browser.");
      }
    }
  }, [step]);

  // Step 3: Selfie setup
  useEffect(() => {
    if (step === 3 && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        .then(stream => {
          videoRef.current.srcObject = stream;
        })
        .catch(err => {
          setStatusMsg("Camera access denied or unavailable.");
        });
    }
    
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [step]);

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setSelfie(dataUrl);
      
      // Stop camera
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const submitCheckIn = async () => {
    setIsSubmitting(true);
    setStatusMsg("1/3: Verificando token QR...");
    
    try {
      // 1. Verify Token with API
      const tokenRes = await fetch('/api/verify-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: scannedToken, userId: user.uid, location })
      });
      
      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        let errorMsg = "Error en el servidor";
        try {
          const tokenData = JSON.parse(text);
          errorMsg = tokenData.error || errorMsg;
        } catch(e) {
          errorMsg = `Error HTTP ${tokenRes.status}`;
        }
        throw new Error(errorMsg);
      }

      setStatusMsg("2/3: Subiendo selfie de seguridad...");
      // 2. Upload Selfie
      if (!storage) throw new Error("Firebase Storage no está inicializado. Revisa las variables de entorno.");
      
      const storageRef = ref(storage, `selfies/${user.uid}_${Date.now()}.jpg`);
      
      // Añadimos metadatos explícitos para asegurar que pase las reglas de seguridad
      const metadata = {
        contentType: 'image/jpeg',
        customMetadata: {
          'userId': user.uid
        }
      };

      try {
        await uploadString(storageRef, selfie, 'data_url', metadata);
      } catch (uploadError) {
        console.error("Error detallado de subida:", uploadError);
        throw new Error(`Error al subir la foto: ${uploadError.code || uploadError.message}`);
      }
      
      const selfieUrl = await getDownloadURL(storageRef);

      setStatusMsg("3/3: Guardando asistencia...");
      // 3. Save Attendance Record
      if (!db) throw new Error("Firestore no está inicializado.");
      
      await addDoc(collection(db, 'attendance'), {
        userId: user.uid,
        email: user.email,
        timestamp: serverTimestamp(),
        location,
        deviceInfo: navigator.userAgent,
        selfieUrl,
        tokenId: scannedToken,
        status: 'verified'
      });

      setStatusMsg("¡Completado!");
      setStep(4);
    } catch (error) {
      console.error("Check-in error:", error);
      setStatusMsg("Error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !user) return <div className="container mt-4 text-center">Loading...</div>;

  return (
    <div className="container">
      <div className="navbar mb-4 glass-panel">
        <h3>Duty Check-In</h3>
        <button onClick={() => auth.signOut()} className="secondary">Sign Out</button>
      </div>

      <div className="card max-w-md mx-auto" style={{maxWidth: '500px', margin: '0 auto'}}>
        <div className="mb-4">
          <div className="flex justify-between text-muted" style={{fontSize: '0.875rem'}}>
            <span style={{color: step >= 1 ? 'var(--primary)' : ''}}>1. QR</span>
            <span style={{color: step >= 2 ? 'var(--primary)' : ''}}>2. GPS</span>
            <span style={{color: step >= 3 ? 'var(--primary)' : ''}}>3. Selfie</span>
            <span style={{color: step >= 4 ? 'var(--primary)' : ''}}>4. Done</span>
          </div>
          <div style={{height: '4px', background: 'var(--border)', marginTop: '0.5rem', borderRadius: '2px'}}>
            <div style={{height: '100%', background: 'var(--primary)', width: `${(step/4)*100}%`, borderRadius: '2px', transition: 'width 0.3s'}}></div>
          </div>
        </div>

        {statusMsg && step !== 4 && (
          <div className="mb-4 text-center" style={{color: statusMsg.includes('failed') || statusMsg.includes('Error') ? 'var(--danger)' : 'var(--text-main)'}}>
            {statusMsg}
          </div>
        )}

        {step === 1 && (
          <div className="text-center animate-fade-in">
            <h4>Scan Station QR</h4>
            <p className="text-muted mb-4">Point your camera at the station screen</p>
            <div id="qr-reader" style={{ width: '100%', background: '#fff', color: '#000' }}></div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center animate-fade-in py-4">
            <div style={{fontSize: '3rem', animation: 'pulse 1.5s infinite'}}>📍</div>
            <h4 className="mt-4">Verifying Location...</h4>
          </div>
        )}

        {step === 3 && (
          <div className="text-center animate-fade-in">
            <h4>Identity Verification</h4>
            <p className="text-muted mb-4">Please take a clear selfie</p>
            
            {!selfie ? (
              <>
                <video ref={videoRef} autoPlay playsInline style={{width: '100%', borderRadius: 'var(--radius)', transform: 'scaleX(-1)'}}></video>
                <button onClick={captureSelfie} className="w-full mt-4">Take Selfie</button>
              </>
            ) : (
              <>
                <img src={selfie} alt="Selfie preview" style={{width: '100%', borderRadius: 'var(--radius)', transform: 'scaleX(-1)'}} />
                <div className="flex gap-4 mt-4">
                  <button onClick={() => setSelfie(null)} className="secondary w-full" disabled={isSubmitting}>Retake</button>
                  <button onClick={submitCheckIn} className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Confirm Check-in'}
                  </button>
                </div>
              </>
            )}
            <canvas ref={canvasRef} style={{display: 'none'}}></canvas>
          </div>
        )}

        {step === 4 && (
          <div className="text-center animate-fade-in py-4">
            <div style={{fontSize: '4rem', color: 'var(--secondary)'}}>✓</div>
            <h3 className="mt-2">Check-in Complete!</h3>
            <p className="text-muted mt-2">Your attendance has been verified and securely logged.</p>
            <button onClick={() => window.location.reload()} className="mt-4">Done</button>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}} />
    </div>
  );
}
