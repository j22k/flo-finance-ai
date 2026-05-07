import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env.local');
    process.exit(1);
}

const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/make-admin.mjs <user-email>');
    process.exit(1);
}

async function makeAdmin() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await mongoose.connection.db.collection('users').updateOne(
            { email: email.toLowerCase() },
            { $set: { role: 'admin' } }
        );

        if (result.matchedCount === 0) {
            console.error(`User with email ${email} not found.`);
        } else if (result.modifiedCount === 0) {
            console.log(`User ${email} is already an admin.`);
        } else {
            console.log(`Successfully promoted ${email} to admin.`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

makeAdmin();
