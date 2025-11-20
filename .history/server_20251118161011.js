const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cassandra = require('cassandra-driver');

const client = new cassandra.Client({
  contactPoints: ['localhost:9042'],
  localDataCenter: 'datacenter1',
  socketOptions: {
    readTimeout: 10000, // 30 seconds
    connectTimeout: 10000
  }
});

async function startServer() {
  try {
    await client.connect();
    await initializeCassandraData(client);
    
    app.listen(3000, () => {
      console.log('App running on http://localhost:3000');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

async function initializeCassandraData(client) {
    try {
        await client.execute(`
            CREATE KEYSPACE IF NOT EXISTS auth_system 
            WITH replication = { 'class': 'SimpleStrategy', 'replication_factor': 1 }
        `);
        
        await client.execute('USE auth_system');
        
        await client.execute(`
            CREATE TABLE IF NOT EXISTS users (
                username text PRIMARY KEY,
                password text,
                role text,
                secret text
            )
        `);
        
        await client.execute('TRUNCATE users');

        const queries = [
            {
                query: 'INSERT INTO users (username, password, role, secret) VALUES (?, ?, ?, ?)',
                params: ['admin', 'admin_testing', 'admin', 'CTF{n0sql_byp455}']
            },
            {
                query: 'INSERT INTO users (username, password, role, secret) VALUES (?, ?, ?, ?)',
                params: ['user1', 'password1', 'user', 'Nothing to see here']
            },
            {
                query: 'INSERT INTO users (username, password, role, secret) VALUES (?, ?, ?, ?)',
                params: ['test', 'test', 'user', 'Regular user secret']
            }
        ];
        
        for (const { query, params } of queries) {
            await client.execute(query, params, { prepare: true });
        }

        console.log('Data initialized');
    } catch (err) {
        console.error('Error initializing data:', err);
    }
}


const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const MONGO_URI = 'mongodb://localhost:27017/testdb';



mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('Connected to MongoDB');
    await initializeMongoDBData();
    await startServer();
    await initializeCassandraData()
});

// User schema
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String,
    secret: String,
});

const User = mongoose.model('User', userSchema);



async function initializeMongoDBData() {
    try {
        await User.deleteMany({});

        await User.create([
            {
                username: 'admin',
                password: 'admin_testing',
                role: 'admin',
                secret: 'CTF{n0sql_byp455}',
            },
            {
                username: 'user1',
                password: 'password1',
                role: 'user',
                secret: 'Nothing to see here',
                secret: 'No flag for regular users'
            },
            {
                username: 'test',
                password: 'test',
                role: 'user',
                secret: 'Regular user secret',
                secret: 'Still no flag'
            }
        ]);

        console.log('data initialized');
    } catch (err) {
        console.error('error initializing data:', err);
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/level1', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'level1.html'));
});

app.get('/level2', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'level2.html'));
});

app.get('/level3', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'level3.html'));
});


app.post('/level1/login', async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;

        const query = { $where: `this.username == '${username}' && this.password == '${password}'`  };
        
        const users = await User.find(query);
        
        if (users && users.length > 0) {
            const user = users[0];
            res.json({
                success: true,
                message: 'Login successful',
                secret: user.secret
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/level2/login', (req, res) => {
    const credentials = req.body;
    
    User.find(credentials)
        .then(users => {
            if (users && users.length > 0) {
                const user = users[0];
                res.json({
                    success: true,
                    message: 'Login successful',
                    secret: user.secret
                });
            } else {
                res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }
        })
        .catch(err => {
            res.status(500).json({ error: 'Database error' });
        });
});

app.post('/level3/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}' ALLOW FILTERING`;
    const result = await client.execute(query);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      res.json({
        success: true,
        message: 'Login successful',
        secret: user.secret  
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
    return {};
});



app.listen(PORT, () => {
    console.log(`server running on http://localhost:${PORT}`);
});


