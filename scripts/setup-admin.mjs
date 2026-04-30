// Script para crear el usuario admin - usa el JSON directamente
// Ejecutar con: node scripts/setup-admin.mjs <ruta-al-json>
// Ejemplo: node scripts/setup-admin.mjs "C:\Users\jdieg\Downloads\resello-v1-firebase-adminsdk.json"

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('❌ Debes pasar la ruta al JSON: node scripts/setup-admin.mjs <ruta-al-json>');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  console.log(`✅ JSON leído: ${serviceAccount.project_id}`);
} catch(e) {
  console.error('❌ No se pudo leer el archivo JSON:', e.message);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

const ADMIN_EMAIL = 'admin@firedept.com';
const ADMIN_PASSWORD = 'admin12345';

async function setup() {
  console.log('🔧 Configurando usuario admin en Firebase...');

  let uid;
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    uid = existing.uid;
    console.log(`✅ Usuario ya existe con UID: ${uid}`);
  } catch (e) {
    const newUser = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: 'Administrador',
    });
    uid = newUser.uid;
    console.log(`✅ Usuario creado con UID: ${uid}`);
  }

  await db.collection('users').doc(uid).set({
    email: ADMIN_EMAIL,
    role: 'admin',
    displayName: 'Administrador',
    createdAt: new Date(),
  }, { merge: true });

  console.log(`✅ Rol 'admin' asignado en Firestore`);
  console.log('\n🎉 ¡Todo listo!');
  console.log('   Email:    admin@firedept.com');
  console.log('   Password: admin12345');
  console.log('   Abre:     http://localhost:3001\n');
  process.exit(0);
}

setup().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
