import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Simple in-memory token store (works without Firebase Admin SDK)
// In production this would use Firebase Admin, but for local dev this works perfectly
const tokenStore = new Map();

// Clean expired tokens every request
function cleanExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now > data.expiresAt) {
      tokenStore.delete(token);
    }
  }
}

export async function POST(req) {
  try {
    cleanExpiredTokens();
    
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 65 * 1000; // 65 seconds

    // Store in memory
    tokenStore.set(token, {
      createdAt: Date.now(),
      expiresAt,
      used: false
    });

    // Also try to store in Firestore via Admin SDK if available
    try {
      const { getAdminDb } = await import('@/lib/firebase-admin');
      const db = getAdminDb();
      await db.collection('qr_tokens').doc(token).set({
        createdAt: new Date(),
        expiresAt: new Date(expiresAt),
        used: false
      });
    } catch (adminError) {
      // If Admin SDK fails, the in-memory store is still valid
      console.warn('Admin SDK unavailable, using in-memory store:', adminError.message);
    }

    return NextResponse.json({ token, expiresAt });
  } catch (error) {
    console.error('Error generating QR token:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}

// Export the store so verify-qr can access it
export { tokenStore };
