const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cassandra = require('cassandra-driver');
const waitPort = require('wait-port');
// const redis = require('redis'); 
const AWS = require('aws-sdk');
const app = express();
const { MongoClient } = require("mongodb");
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

AWS.config.update({
  region: 'localhost',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fake',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fake'
});

app.use(express.json());


const dynamodb = new AWS.DynamoDB();
const documentClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'users';
let docsDB; 

// const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
// const redisClient = redis.createClient({
//   url: REDIS_URL,
//   legacyMode: true
// });

// redisClient.on('error', (err) => console.log('Redis Client Error', err));
// redisClient.on('connect', () => console.log('Connected to Redis'));

async function initializeDynamoDB() {
  try {
    const tables = await dynamodb.listTables().promise();
    
    if (!tables.TableNames.includes(TABLE_NAME)) {
      console.log('Creating users table...');
      
      const params = {
        TableName: TABLE_NAME,
        KeySchema: [
          { AttributeName: 'username', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'username', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      };
      
      await dynamodb.createTable(params).promise();
      console.log('Users table created successfully');
      
      await dynamodb.waitFor('tableExists', { TableName: TABLE_NAME }).promise();
    } else {
      console.log('Users table already exists');
    }

    const users = [
      { username: 'admin', password: 'admin_testing', role: 'admin', secret: 'FLAG{n0sql_byp455}' },
      { username: 'user1', password: 'password1', role: 'user', secret: 'nop' },
      { username: 'test', password: 'test', role: 'user', secret: 'nop' }
    ];

    console.log('Inserting/updating users...');
    
    for (const user of users) {
      try {
        await documentClient.put({
          TableName: TABLE_NAME,
          Item: user,
          ConditionExpression: 'attribute_not_exists(username)'
        }).promise();
      } catch (error) {
        if (error.code === 'ConditionalCheckFailedException') {
            await documentClient.put({
            TableName: TABLE_NAME,
            Item: user
          }).promise();
        } 
      }
    }
    
    console.log('All users inserted/updated successfully');

  } catch (error) {
    console.error('Error initializing DynamoDB:', error.message);
  }
}

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String,
    secret: String
});

const UserModel = mongoose.model('User', userSchema);

async function initMongoDbDocs() {
    const client = new MongoClient(MONGO_URI);

    await client.connect();
    docsDB = client.db("testdocsDB");     

    const col = docsDB.collection("documents");
    await col.deleteMany({});

    await col.insertMany([
        { title: "public-report", content: "Welcome to the archive." },
        { title: "meeting-log", content: "Team A met with stakeholders." },
        { title: "research-draft", content: "Unfinished ideas." },
        { title: "daily-update", content: "System running normally." },
        { title: "travel-plan", content: "Trip schedule for conference." },
        { title: "todo-list", content: "Buy milk, fix printer, email HR." },
        { title: "maintenance-log", content: "Server patch completed." },
        { title: "bugreport-2104", content: "CSS alignment issue on page." },

        { title: "usernote-jason", content: "Remember to check backups." },
        { title: "usernote-mary", content: "Lunch at 1pm tomorrow." },
        { title: "usernote-kevin", content: "Draft the slides by Monday." },
        { title: "thoughts-alice", content: "Should refactor the codebase." },
        { title: "idea-dump", content: "Tiny brainstorming sketches." },

        { title: "misc-scrap", content: "Old document. Discard later." },
        { title: "archive-old-1", content: "Legacy asset – not important." },
        { title: "archive-old-2", content: "Contains obsolete formats." },
        { title: "random-text", content: "asdiu3y1b289y18y289yasyd" },
        { title: "log-junk", content: "ERROR: null pointer LOL" },
        { title: "config-notes", content: "Don't forget to restart service." },
        { title: "draft-alpha", content: "v0.0.1 concept materials." },
        { title: "draft-beta", content: "v0.0.2 placeholder notes." },
        { title: "status-report", content: "Everything is nominal." },

        { title: "tmp1", content: "temp file" },
        { title: "tmp2", content: "temp file again" },
        { title: "tmp3", content: "temp file thrice" },
        { title: "notes-sept", content: "Meeting rescheduled to Friday." },
        { title: "notes-oct", content: "Working on documentation." },
        { title: "admin-notes", secret: "FLAG{n0sql_byp455}",
          content: "If you're reading this, you bypassed the filter." }
    ]);

}

async function initializeMongoData() {
    await UserModel.deleteMany({});
    await UserModel.create([
        { username: 'admin', password: 'admin_testing', role: 'admin', secret: 'FLAG{n0sql_byp455}' },
        { username: 'user1', password: 'password1', role: 'user', secret: 'nop' },
        { username: 'test', password: 'test', role: 'user', secret: 'nop' }
    ]);
}

async function initializeRedisData() {
    await redisClient.flushAll();
    
    const users = [
        { username: 'admin', password: 'admin_testing', role: 'admin', secret: 'FLAG{n0sql_byp455}' },
        { username: 'user1', password: 'password1', role: 'user', secret: 'nop' },
        { username: 'test', password: 'test', role: 'user', secret: 'nop' }
    ];
    
    for (const user of users) {
        await redisClient.set(`user:${user.username}:password`, user.password);
        await redisClient.set(`user:${user.username}:role`, user.role);
        await redisClient.set(`user:${user.username}:secret`, user.secret);
    }
    
    console.log('Redis data initialized');
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
        { query: 'INSERT INTO users (username, password, role, secret) VALUES (?, ?, ?, ?)', params: ['admin', 'admin_testing', 'admin', 'FLAG{n0sql_byp455}'] },
        { query: 'INSERT INTO users (username, password, role, secret) VALUES (?, ?, ?, ?)', params: ['user1', 'password1', 'user', 'nop'] },
        { query: 'INSERT INTO users (username, password, role, secret) VALUES (?, ?, ?, ?)', params: ['test', 'test', 'user', 'nop'] }
    ];
    for (const { query, params } of queries) {
        await cassandraClient.execute(query, params, { prepare: true });
    }
}

async function startServer() {
    await waitPort({ host: 'mongo', port: 27017 });
    await waitPort({ host: 'cassandra', port: 9042 });
    // await waitPort({ host: 'redis', port: 6379 });

    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await initializeMongoData();
    await initMongoDbDocs();

    await cassandraClient.connect();
    await initializeCassandraData();

    // await redisClient.connect();
    // await initializeRedisData();

    // await initializeDynamoDB()

    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer().catch(err => console.error(err));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/level1', (req, res) => res.sendFile(path.join(__dirname, 'public', 'level1.html')));
app.get('/level2', (req, res) => res.sendFile(path.join(__dirname, 'public', 'level2.html')));
app.get('/level3', (req, res) => res.sendFile(path.join(__dirname, 'public', 'level3.html')));
app.get('/level4', (req, res) => res.sendFile(path.join(__dirname, 'public', 'level4.html')));
app.get('/level5', (req, res) => res.sendFile(path.join(__dirname, 'public', 'level5.html')));
app.get('/level6', (req, res) => res.sendFile(path.join(__dirname, 'public', 'level6.html')));


app.post('/level1/login', async (req, res) => {
    const { username, password } = req.body;
    try{
        const query = { $where: `this.username == '${username}' && this.password == '${password}'` };
        const users = await UserModel.find(query);
        if (users.length > 0) {
            res.json({ success: true, message: 'Login successful', secret: users[0].secret });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/level2/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const query = { $where: `(this.username == '${username}') && (this.password == '${password}')`};
        const users = await UserModel.find(query);
        if (users.length > 0) {
            res.json({ success: true, message: 'Login successful', secret: users[0].secret });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/level3/login", async (req, res) => {
    const { username, password } = req.body;

    try {
    const user = await UserModel.findOne({
        username:
        username.startsWith("{") && username.endsWith("}")
            ? JSON.parse(username)
            : username,
        password:
        password.startsWith("{") && password.endsWith("}")
            ? JSON.parse(password)
            : password,
    });

    if (user) {
        res.json({ success: true, message: 'Login successful', secret: user.secret });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/level4/login', async (req, res) => {
    const users = await UserModel.find(req.body);
    try{
        if (users.length > 0) {
            res.json({ success: true, message: 'Login successful', secret: users[0].secret });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/level5/login', async (req, res) => {
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
        res.status(500).json({ message: err.message });
    }
});


app.post("/level6/search", async (req, res) => {
    const { query, projection } = req.body;

    try {
        const results = await docsDB.collection("documents").find(
            {
                title: { $regex: query, $options: "i" }
            },
            projection || {}  
        ).toArray();

        const filtered = results.filter(doc =>
            !doc.title?.toLowerCase().includes("admin")
        );

        res.json({ success: true, results: filtered });

    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.post("/level6/getAllRecords", async (req, res) => {
    try {
        const docs = await docsDB.collection("documents")
            .find({ title: { $not: /admin/i } }) 
            .toArray();
        res.json({ success: true, results: docs });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});