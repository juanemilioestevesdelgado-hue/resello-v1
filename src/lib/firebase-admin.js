import admin from 'firebase-admin';

export function getAdmin() {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        // Fallback for build phase or testing without keys
        admin.initializeApp();
      }
    } catch (error) {
      console.error('Firebase admin initialization error', error.message);
    }
  }
  return admin;
}

export const getAdminDb = () => getAdmin().firestore();
export const getAdminAuth = () => getAdmin().auth();
export const getAdminStorage = () => getAdmin().storage();
