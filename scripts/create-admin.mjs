import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env.local');
    process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 3) {
    console.error('Usage: node scripts/create-admin.mjs <name> <email> <password>');
    process.exit(1);
}

const [name, email, password] = args;

async function createAdmin() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const hashedPassword = await bcrypt.hash(password, 12);

        const adminUser = {
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await mongoose.connection.db.collection('users').insertOne(adminUser);

        console.log(`Successfully created new admin user: ${name} (${email})`);
        console.log(`User ID: ${result.insertedId}`);

    } catch (error) {
        if (error.code === 11000) {
            console.error('Error: A user with this email already exists.');
        } else {
            console.error('Error:', error);
        }
    } finally {
        await mongoose.disconnect();
    }
}

createAdmin();
