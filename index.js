const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'access unauthorized' })
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRECT, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'access unauthorized' })
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jd8zyik.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const instructorCollection = client.db("summerCamp").collection("instructor");
    const classCollection = client.db("summerCamp").collection("class");
    const allUsersCollection = client.db("summerCamp").collection("users");
    const paymentCollection = client.db("bistroDb").collection("payments");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRECT, { expiresIn: '1h' })
      res.send({ token })
    })


    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await allUsersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'access forbidden' })
      }
      next();
    }
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await allUsersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'access forbidden' })
      }
      next();
    }

    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await allUsersCollection.find().toArray();
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email }
      const existingUser = await allUsersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user is already LoggedIn' })
      }
      const result = await allUsersCollection.insertOne(user);
      res.send(result)
    });

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await allUsersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await allUsersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.get('/instructor', async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result)
    })
    // roll instructor
    app.patch('/users/instructors/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'Instructor'
        }
      };
      const result = await allUsersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // class collection APIS
    app.get('/class', verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email)
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== jwt.decodedEmail) {
        return res.status(401).send({ error: true, message: 'access forbidden' })
      }

      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      res.send(result)
    });

    app.post('/class', async (req, res) => {
      const clas = req.body;
      console.log(clas);
      const result = await classCollection.insertOne(clas);
      res.send(result);
    })
    // app.post("/create-payment-intent", async (req, res) => {
    // const { items } = req.body     
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;


      const amount = parseInt(price * 100);
      console.log(price, amount);


      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result)
    })




    app.post('/class', async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    })

    app.delete('/class/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.deleteOne(query);
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Summer camp is start')
})

app.listen(port, () => {
  console.log(`Summer camp is starting on ${port}`);
})

