const express = require("express")
const cors = require("cors")
const app = express()
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require("jsonwebtoken")
const stripe = require("stripe")(process.env.PAYMENT_KEY)

app.use(cors())
app.use(express.json())



const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.2slrhpw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const varifyJWT = (req,res,next) =>{

  const Authorization = req.headers.authorization;
 
  if(!Authorization){
    res.status(401).send({error:true, massage:"unauthorized"})
  }
  const token = Authorization.split(" ")[1]
  jwt.verify(token,process.env.PRIVET_TOKEN,(error,decoded) =>{
      if(error){
        res.status(401).send({error:true, massage:"unauthorized"})
      }
      
      req.decoded = decoded.data.email
  })
    next()
}


// jwt create for user

app.post("/jwt", (req,res) =>{
    const data = req.body;
      const token = jwt.sign({
        data:data,
      },process.env.PRIVET_TOKEN,{ expiresIn: '1h' })
      
      res.send({token})
})



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    
   
    const userCollection = client.db("summercampDB").collection("users");
    const classCollection = client.db("summercampDB").collection("classes");
    const addedClassCollection = client.db("summercampDB").collection("addedClass");
    const paymentsCollection = client.db("summercampDB").collection("payments");

    // added student selected  Class store data

    app.post("/addedClass", async(req,res) =>{
        const addClass = req.body;
        const result = await addedClassCollection.insertOne(addClass)
        res.send(result)
    })

    // get student added class collection
    app.get("/addedClass/:email",async(req,res)=>{
        const email = req.params.email;
        const query = {email:email}
        const result = await addedClassCollection.find(query).toArray()
        res.send(result)
       
    })

    // delete  student addClass apis
    app.delete("/addClass/:id", async(req,res) =>{
        const id= req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await addedClassCollection.deleteOne(query)
        res.send(result)
    })


    // store all new user
    app.post("/users", async(req,res)=>{
        const user = req.body;
        const query = {email: user.email}
        const checkUser = await userCollection.findOne(query)
            if(checkUser){
                return res.send({massage: "user alrady exist"})
            }
        const result = await userCollection.insertOne(user)
        res.send(result)
    })

    // show all approved classes 
    app.get("/showAllClasses", async(req,res)=>{
        const query = {status:"approved"}
        const result =await classCollection.find(query).sort({enrolled:-1}).toArray()
        res.send(result)
    })



    //show Instractor data
    app.get("/instractors",async(req,res)=>{
        const query = {role:"instractor"}
        const result = await userCollection.find(query).toArray()
        res.send(result)
    })

    // get all users
    app.get("/users", async(req,res)=>{
        const result = await userCollection.find().toArray()
        res.send(result)
    })

    // post new classes
    app.post("/classes", async(req,res) =>{
        const newClass = req.body;
        const result = await classCollection.insertOne(newClass)
        res.send(result)

    })


    // get instractor classes for instractor

    app.get("/classes/:email", async(req,res)=>{
        const email = req.params.email;
        const query = {email:email}
        const result =await classCollection.find(query).toArray()
        res.send(result)
    })

   

    // get all classes for admin 
    app.get("/classes", varifyJWT, async(req,res) =>{
      
      const result = await classCollection.find().toArray()
      res.send(result)
    })

    // manage classes 
    app.patch("/manageClass", async(req,res) =>{
        const id = req.query.id;
        const option = req.query.option;
        const query = {_id: new ObjectId(id)}

        const updateDoc = {
          $set:{
            status:option
          }
        }

        const result = await classCollection.updateOne(query,updateDoc)
        res.send(result)
    })

    // admin feedback for classes 
    app.patch("/classFeedback/:id", async(req,res)=>{
      const {massage} = req.body
          const id = req.params.id;         
          const query = {_id:new ObjectId(id)}
         
          const updateDoc = {
            $set:{
              feedback:massage
            }
          }
          const result = await classCollection.updateOne(query,updateDoc)
          res.send(result)
    })




    // user Enroll classes Api 
    app.get("/enrollClasses/:email", async(req,res)=>{
          const email = req.params.email;
          const query = {email:email}
          const result = await paymentsCollection.find(query).toArray()
          res.send(result)
    })
    // user Payment History api 
    app.get("/paymentHistory/:email", async(req,res)=>{
        const email = req.params.email;
        const query = {email:email}
        const result = await paymentsCollection.find(query).sort({paymentDate:-1}).toArray()
          res.send(result)
    })

    // make instractor api
    app.patch("/users/instractor/:email", async(req,res) =>{
        const userEmail = req.params.email;
        const query = {email:userEmail}
        const updateDoc = {
          $set:{
            role:"instractor"
          }
        }
        const result =await userCollection.updateOne(query,updateDoc)
        res.send(result)
    })


    // make admin api
    app.patch("/users/admin/:email", async(req,res) =>{
      const userEmail = req.params.email;
      const query = {email:userEmail}
      const updateDoc = {
        $set:{
          role:"admin"
        }
      }
      const result =await userCollection.updateOne(query,updateDoc)
      res.send(result)
  })


    // get users Roles

    app.get("/userRole/:email",varifyJWT, async(req,res) =>{
      
      const decodeEmail = req.decoded
        
        const email = req.params.email;

        if(decodeEmail !== email){
          res.status(404).send({error:true, massage:"forbidden"})
        }
        
        const query = {email:{ $regex: email, $options: "i" }}
        const presentUser =await userCollection.findOne(query)
        const role = {userRole:presentUser?.role}
        
        res.send(role)
    })

    // create payment Intent
    app.post("/create-payment-intent", async (req, res) => {
        const items = req.body;
        const amount = parseFloat((items.price * 100).toFixed(2));
       
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: [
            "card"
          ],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
    })

    // storer payment info
    
    app.post("/payments",async(req,res) =>{
      const newPayment = req.body;
       
        const query= {_id: new ObjectId(newPayment.classId)}
        const findClass = await classCollection.findOne(query)
       
        const updateSeat = findClass.seats - 1;
        const enroleCount = findClass.enrolled + 1
        
        const updateDocs = {
          $set:{
            seats: updateSeat,
            enrolled:enroleCount
          }
        }
        const updateClass = await classCollection.updateOne(query,updateDocs)

        // find selectClass and Remove this Class
       const selectClassQuery = {_id: new ObjectId(newPayment.selectClassId)}
       const removeSelectClass = addedClassCollection.deleteOne(selectClassQuery)
        const result =await paymentsCollection.insertOne(newPayment)
        res.send(result)
    } )


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get("/", (req,res) =>{
    res.send("sportySummerCamp server is Running Now.............")
})

app.listen(port, ()=> console.log(`server is running port ${5000}`))