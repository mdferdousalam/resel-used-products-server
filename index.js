const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { query } = require('express');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 5000;

const app = express();

app.use(cors({
    origin: ["http://localhost:3000", "https://assignment12-e6ef6.web.app"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    // credentials: true,
    // "Access-Control-Allow-Credentials": true,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
}))

// middleware
// app.use(cors());
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
        const productsCollection = client.db('assignment12').collection('products');

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

            if (user?.accountType !== 'admin') {
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
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray();
            console.log(users)
            res.send(users)
        })
        // Delete users 
        app.delete('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.query.id;
            const filter = { _id: ObjectId(id) }
            const users = await usersCollection.deleteOne(filter)
            console.log(users)
            res.send(users)
        })


        // admin users 
        app.get('/users/admin', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            console.log(user);
            res.send({ isAdmin: user?.accountType === "admin" });
        })
        // buyers 
        app.get('/users/buyer', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isBuyer: user?.accountType === 'buyer' });
        })
        //All buyers 
        app.get('/users/buyers', verifyJWT, verifyAdmin, async (req, res) => {
            const accountType = 'buyer'
            const query = { accountType: accountType }
            const cursor = usersCollection.find(query);
            const result = await cursor.toArray()
            res.send(result);
        })
        // Seller 
        app.get('/users/seller', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.accountType === 'seller' });
        })
        // All Sellers
        app.get('/users/sellers', verifyJWT, verifyAdmin, async (req, res) => {
            const accountType = 'seller';
            const query = { accountType: accountType }
            const cursor = usersCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        // product adding 
        app.post('/products', verifyJWT, async (req, res) => {
            const products = req.body;
            const result = await productsCollection.insertOne(products)
            res.send(result)
        })
        // product deleteing
        app.delete('/deleteproducts', verifyJWT, async (req, res) => {
            const id = req.query.id;
            const filter = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(filter)
            res.send(result)
        })

        // product status updating
        app.post('/updateproducts', verifyJWT, async (req, res) => {
            const products = req.body;
            delete products._id
            // console.log(products);
            const id = req.query.id;
            const query = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {
                $set: products,
            }
            const result = await productsCollection.updateOne(query, updatedDoc, options)
            res.setHeader("Access-Control-Allow-Origin", "*")
            res.setHeader("Access-Control-Allow-Headers", "*")
            res.send(result)
        })




        // Advertised products 
        app.get('/advertisedproducts', async (req, res) => {

            const query = { advertised: true, status: 'available' };
            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        // ordered products finding API
        app.get('/orderedproducts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { buyerEmail: email, status: 'available' };
            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })
        // payment products finding API
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id
            // const email = req.query.email;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.findOne(query);
            res.send(result)
        })

        // wishlisted products 
        app.get('/wishListedproducts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { buyerEmail: email, wishList: true, status: 'available' };
            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })
        // Reported products cl
        app.get('/reportedtedproducts', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { reported: true };
            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        // individual seller's products finding API 
        app.get('/products', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { sellerEmail: email }
            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })


        // apple category product finding for home page 
        app.get('/products/apple', verifyJWT, async (req, res) => {
            const appleCategory = 'apple'
            const query = { category: appleCategory }
            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        // samsung category wise products finding API 
        app.get('/products/samsung', verifyJWT, async (req, res) => {
            const samsungCategory = 'samsung'
            const query = { category: samsungCategory }
            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)

        })
        // Oppo category wise products finding API 
        app.get('/products/oppo', verifyJWT, async (req, res) => {
            const oppoCategory = 'oppo'
            const query = { category: oppoCategory }
            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)

        })


        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: [
                    'card'
                ]
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
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