/**
 * OfficeSeat — Admin provisioning script (development only)
 *
 * Creates the predefined Admin account, sets a trusted `admin` custom
 * claim, and creates the Admin Firestore profile. Safe to re-run.
 *
 * Usage:
 *   1. Generate a service account key:
 *      Firebase Console → Project Settings → Service Accounts →
 *      "Generate new private key" → save as serviceAccountKey.json
 *   2. Set the environment variable:
 *      export FIREBASE_ADMIN_SERVICE_ACCOUNT="$(cat serviceAccountKey.json)"
 *      (or set FIREBASE_ADMIN_SERVICE_ACCOUNT to the file path)
 *   3. Run:  npm run seed-admin
 *
 * NEVER commit the service account key. Add serviceAccountKey.json to
 * .gitignore. This script runs only in a trusted local environment and
 * never touches the frontend bundle.
 *
 * Required env vars (read by the script, not Vite):
 *   FIREBASE_ADMIN_SERVICE_ACCOUNT  JSON string or path to a JSON file.
 *   VITE_FIREBASE_PROJECT_ID         Optional fallback for project ID.
 *   VITE_FIREBASE_API_KEY            Not needed here, but harmless.
 */
import admin from 'firebase-admin';

const ADMIN_EMAIL = 'admin@officeseat.demo';
const ADMIN_PASSWORD = 'AdminDemo!2026';

function loadServiceAccount(): admin.ServiceAccount {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!raw) {
    console.error(
      '\nFIREBASE_ADMIN_SERVICE_ACCOUNT is not set.\n' +
        'Generate a service account key from the Firebase Console and run:\n' +
        '  export FIREBASE_ADMIN_SERVICE_ACCOUNT="$(cat serviceAccountKey.json)"\n',
    );
    process.exit(1);
  }
  try {
    // If it's a file path
    if (raw.trim().startsWith('/')) {
      return require(raw.trim()) as admin.ServiceAccount;
    }
    return JSON.parse(raw) as admin.ServiceAccount;
  } catch {
    console.error('Could not parse FIREBASE_ADMIN_SERVICE_ACCOUNT. Provide valid JSON or a path.');
    process.exit(1);
  }
}

async function main() {
  const serviceAccount = loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const auth = admin.auth();
  const db = admin.firestore();

  let user: admin.auth.UserRecord;
  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`✓ Admin user already exists: ${user.uid}`);
    // Ensure password matches the demo value
    await auth.updateUser(user.uid, { password: ADMIN_PASSWORD, emailVerified: true });
    console.log('✓ Admin password reset to demo value.');
  } catch {
    user = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
      displayName: 'OfficeSeat Admin',
      disabled: false,
    });
    console.log(`✓ Created admin user: ${user.uid}`);
  }

  // Set custom claim
  await auth.setCustomUserClaims(user.uid, { admin: true, role: 'admin' });
  console.log('✓ Set admin custom claim.');

  // Create / update Firestore profile
  const profileRef = db.doc(`users/${user.uid}`);
  const snap = await profileRef.get();
  if (!snap.exists) {
    await profileRef.set({
      displayName: 'OfficeSeat Admin',
      email: ADMIN_EMAIL,
      active: true,
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✓ Created admin Firestore profile.');
  } else {
    await profileRef.update({
      role: 'admin',
      active: true,
      email: ADMIN_EMAIL,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✓ Updated admin Firestore profile.');
  }

  // Ensure settings doc exists with defaults
  const settingsRef = db.doc('settings/general');
  const settingsSnap = await settingsRef.get();
  if (!settingsSnap.exists) {
    await settingsRef.set({
      advanceBookingDays: 14,
      maxBookingsPerDay: 1,
      cancellationDeadlineHours: 2,
      workingDays: [1, 2, 3, 4, 5],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✓ Created default settings document.');
  }

  console.log('\n✅ Admin provisioning complete.');
  console.log('   Email:    ' + ADMIN_EMAIL);
  console.log('   Password: ' + ADMIN_PASSWORD);
  console.log('\nYou can now sign in at /login with the Admin Demo Login section.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ Admin provisioning failed:', err.message || err);
  process.exit(1);
});
