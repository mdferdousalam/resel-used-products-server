const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kykmokn.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}


async function run() {
    try {

        const usersCollection = client.db('assignment12').collection('users');

        // JWT token createing 
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            console.log(req.query)
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' })
                return res.send({ accessToken: token });
            }
            console.log(token)
            res.status(403).send({ accessToken: '' })
        });


        // admin verification 
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbiden access' })
            }
            next()
        }


        app.post('/users', async (req, res) => {
            const user = req.body
            const query = {
                email: user.email,
            }
            const alreadyAccountCreated = await usersCollection.find(query).toArray();
            // checking if the account already exist or not 
            if (alreadyAccountCreated.length) {
                const message = `You already have an account by this email ${user.email}`
                return res.send({ acknowledged: false, message })
            }

            const result = await usersCollection.insertOne(user)
            console.log(result)
            res.send({ result })
        })

        // all users 
        app.get('/users', async (req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray();
            console.log(users)
            res.send(users)
        })


        // admin users 
        app.get('/users/admin', async (req, res) => {
            const email = req.query.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            console.log(user);
            res.send({ isAdmin: user?.accountType === "admin" });
        })
        // buyers 
        app.get('/users/buyer', async (req, res) => {
            const email = req.query.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isBuyer: user?.accountType === 'buyer' });
        })
        //All buyers 
        app.get('/users/buyers', async (req, res) => {
            const accountType = 'buyer'
            const query = { accountType: accountType }
            const cursor = usersCollection.find(query);
            const result = await cursor.toArray()
            res.send(result);
        })
        // Seller 
        app.get('/users/seller', async (req, res) => {
            const email = req.query.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.accountType === 'seller' });
        })
        // All Sellers
        app.get('/users/sellers', async (req, res) => {
            const accountType = 'seller';
            const query = { accountType: accountType }
            const cursor = usersCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })


    }
    finally {

    }
}
run().catch(console.log);


app.get('/', async (req, res) => {
    res.send('Reselling market server is running');
})

app.listen(port, () => console.log(`Reselling market server running on ${port}`))