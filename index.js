require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const isUrl = require('is-url');

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

// Get our cluster URI
const MONGO_URI = process.env.MONGO_URI;

// Connect our mongoose
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Create a URL schema
let shortUrlSchema = new mongoose.Schema({
  original_url: {
    type: String,
    required: true
  },
  short_url: {
    type: Number,
    required: true
  }
})

// Create shortUrl Model from shorUrl schema
const ShortUrl = mongoose.model('ShortUrl', shortUrlSchema);

// Create counter schema; to handle increment sequence value
const counterSchema = new mongoose.Schema({
  id: {
    type: String
  },
  sequence_value: {
    type: Number
  }
})

// Create counter model
const Counter = mongoose.model('Counter', counterSchema);

// Function to update our counter record
const updateCounter = () => {
  return new Promise((resolve, reject) => {
    // Find by id, increment sequence_value field by 1
    Counter.findOneAndUpdate(
      {id:"counterid"},
      {"$inc": {"sequence_value": 1}},
      {new:true}, async (err, data) => {
        // Declare variable to store increment value from record
        let sequenceId;
        
        // IF there's no document in counter record yet, set and save it. Which sequence_value to 1
        // ELSE just get sequence_value field, and save to sequenceId variable above
        if (data == null) {
          const firstRecord = new Counter({id: "counterid", sequence_value: 1});
          await firstRecord.save();
          sequenceId = 1;
        } else {
          sequenceId = data.sequence_value;
        }

        // Resolve by return sequenceId variable
        resolve(sequenceId);
      }
    )
  })
}


// Parser body to post
app.use(bodyParser.urlencoded({extended: false}));

// Get shorturl key method to redirect to it's url
app.get('/api/shorturl/:shorturl', async(req, res) => {
  // Get key from /shorturl/<shorturl>
  const shortid = req.params.shorturl;
  // Find record by shorturl key
  const record = await ShortUrl.findOne({ short_url: shortid })

  // If doesn't exist yet, send Not Found
  if (!record) return res.sendStatus(404);

  // Go to original url
  res.redirect(record.original_url);
})

// Post url method
app.post('/api/shorturl', async(req, res) => {
  // Get post url
  const url = req.body.url;

  // Check IF post URL is NOT valid, send Invalid URL. Otherwise, save the URL
  if (!isUrl(url)) {
    res.send({error: "Invalid URL"});
  } else {
    // First, check if POST URL already exist in record
    const checkRecord = await ShortUrl.findOne({original_url: url});
  
    // If NOT exist yet, increment sequence_value field in counter record to use it as short url
    if(!checkRecord) {
      await updateCounter()
        .then(async (res) => {
          // Create new record with res which sequenceId for shortUrl
          const record = new ShortUrl({original_url: url, short_url: res});
          await record.save();
        })
    }

    // If URL already in record, respond the data
    // OR also after create it
    let urlRecordData = await ShortUrl.findOne({original_url: url}, {original_url: 1, short_url: 1, _id: 0});
    res.send(urlRecordData);
  }
})
  
app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

exports.shortUrlModel = ShortUrl;
exports.counterModel = Counter;
exports.updateCounter = updateCounter;
