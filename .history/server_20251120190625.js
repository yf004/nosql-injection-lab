const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cassandra = require('cassandra-driver');
const waitPort = require('wait-port');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/testdb';
const CASSANDRA_CONTACT_POINTS = process.env.CASSANDRA_CONTACT_POINTS || 'cassandra:9042';

const cassandraClient = new cassandra.Client({
    contactPoints: [CASSANDRA_CONTACT_POINTS],
    localDataCenter: 'datacenter1'
});

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String,
    secret: String
});

const UserModel = mongoose.model('User', userSchema);


const waitPort = require('wait-port');



async function initializeMongoData() {
    await UserModel.deleteMany({});
    await UserModel.create([
        { username: 'admin', password: 'admin_testing', role: 'admin', secret: 'CTF{n0sql_byp455}' },
        { username: 'user1', password: 'password1', role: 'user', secret: 'No flag for regular users' },
        { username: 'test', password: 'test', role: 'user', secret: 'Still no flag' }
    ]);
}

async function initializeCassandraData() {
    await cassandraClient.execute(`
        CREATE KEYSPACE IF NOT EXISTS auth_system
        WITH replication = { 'class': 'SimpleStrategy', 'replication_factor': 1 }
    `);
    await cassandraClient.execute('USE auth_system');
    await cassandraClient.execute(`
        CREATE TABLE IF NOT EXISTS users (
            username text PRIMARY KEY,
            password text,
            role text,
            secret text
        )
    `);
    await cassandraClient.execute('TRUNCATE users');
    const queries = [
        { query: 'INSERT INTO users (username, password, role, secret) VALUES (?, ?, ?, ?)', params: ['admin', 'admin_testing', 'admin', 'CTF{n0sql_byp455}'] },
        { query: 'INSERT INTO users (username, password, role, secret) VALUES (?, ?, ?, ?)', params: ['user1', 'password1', 'user', 'Nothing to see here'] },
        { query: 'INSERT INTO users (username, password, role, secret) VALUES (?, ?, ?, ?)', params: ['test', 'test', 'user', 'Regular user secret'] }
    ];
    for (const { query, params } of queries) {
        await cassandraClient.execute(query, params, { prepare: true });
    }
}


async function startServer() {
    await waitPort({ host: 'mongo', port: 27017 });
    await waitPort({ host: 'cassandra', port: 9042 });

    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await initializeMongoData();

    await cassandraClient.connect();
    await initializeCassandraData();

    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer().catch(err => console.error(err));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/level1', (req, res) => res.sendFile(path.join(__dirname, 'public', 'level1.html')));
app.get('/level2', (req, res) => res.sendFile(path.join(__dirname, 'public', 'level2.html')));
app.get('/level3', (req, res) => res.sendFile(path.join(__dirname, 'public', 'level3.html')));

app.post('/level1/login', async (req, res) => {
    const { username, password } = req.body;
    const query = { $where: `this.username == '${username}' && this.password == '${password}'` };
    const users = await UserModel.find(query);
    if (users.length > 0) {
        res.json({ success: true, message: 'Login successful', secret: users[0].secret });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/level2/login', async (req, res) => {
    const users = await UserModel.find(req.body);
    if (users.length > 0) {
        res.json({ success: true, message: 'Login successful', secret: users[0].secret });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/level3/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await cassandraClient.execute(
            `SELECT * FROM users WHERE username='${username}' AND password='${password}' ALLOW FILTERING`
        );
        if (result.rows.length > 0) {
            res.json({ success: true, message: 'Login successful', secret: result.rows[0].secret });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
