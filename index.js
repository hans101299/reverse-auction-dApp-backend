import express from 'express';
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client'
import cors from "cors";
import dotenv from 'dotenv'
import reverseAuction from './ReverseAuction.json' assert { type: "json" };
import nftModifierAuction from './ModifierReverseAuction.json' assert { type: "json" };
import nftTicketAuction from './ModifierReverseAuction.json' assert { type: "json" };
dotenv.config()

// Set up Ethereum provider and contract
const provider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/eth_goerli");
const reverseAuctionAddress = '0x7feCb0441B565F5Fbe7484EA23436f7d7Bd1D2d2';
const nftTicketAddress = "0xC195aD5b8d1521fb7913D25f6dF048DDcAF9fe36";
const nftModifierAddress = "0xf1FFdA54C75A053fA99bE3375c9034699a56F173";

const ReverseAuctionContract = new ethers.Contract(reverseAuctionAddress, reverseAuction.abi, provider);
const NFTModifierContract = new ethers.Contract(nftModifierAddress, nftModifierAuction.abi, provider);
const NFTTicketContract = new ethers.Contract(nftTicketAddress, nftTicketAuction.abi, provider);


const signer = new ethers.Wallet(process.env.ADMIN_ACCOUNT_PRIVATE_KEY, provider);

// Create an Express app
const app = express();

app.use(express.json());
app.use(cors());


const projectId = process.env.INFURA_KEY;
const projectSecret = process.env.INFURA_SECRET;
const auth =
  "Basic " + Buffer.from(projectId + ":" + projectSecret).toString("base64");
const ipfs = await create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    authorization: auth,
  },
})

function getRandomColor() {
  // Generate random values for red, green, and blue channels
  var red = Math.floor(Math.random() * 256);
  var green = Math.floor(Math.random() * 256);
  var blue = Math.floor(Math.random() * 256);

  // Create the HTML color code
  var colorCode = red.toString(16).padStart(2, '0') + green.toString(16).padStart(2, '0') + blue.toString(16).padStart(2, '0');

  return colorCode;
}

function generateRandomNumber(options) {
  const totalWeight = options.reduce((total, option) => total + option.probability, 0);
  const random = Math.random() * totalWeight;

  let cumulativeWeight = 0;
  for (const option of options) {
    cumulativeWeight += option.probability;

    if (random <= cumulativeWeight) {
      return option.value;
    }
  }
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(num, size) {
  num = num.toString();
  while (num.length < size) num = "0" + num;
  return num;
}

var types = {
  0: "DECIMAL",
  1: "DIVISION",
  2: "SUBTRACTION",
  3: "ADDITION",
  4: "MULTIPLICATION"
};


const optionsValue = [
  { value: 2, probability: 25 }, 
  { value: 3, probability: 20 },
  { value: 4, probability: 15 },
  { value: 5, probability: 10 },
  { value: 6, probability: 8 },
  { value: 7, probability: 5 },
  { value: 8, probability: 3 },
  { value: 9, probability: 2 },
  { value: 10, probability: 1 }
];

const optionsType = [
  { value: 0, probability: 20 },
  { value: 1, probability: 5 },
  { value: 2, probability: 30 }, 
  { value: 3, probability: 25 },
  { value: 4, probability: 20 },
];


async function uploadMetadata(ticket){
  const myImmutableAddress = await ipfs.add(JSON.stringify(ticket))
  return myImmutableAddress.path;
}

// Define the function to be executed when the event occurs
function handleCreateAuctionEvent(owner,auctionId) {
  // Execute your desired function here
  console.log('Create Auction emitted:', owner,auctionId);

  // You can do additional processing or trigger other actions as needed
}

async function handleCommitEvent(bidder, auctionId, ticketId){
  var ticket = {
    "name": "TICKET#"+ticketId.toString(),
    "description": "A NFT Ticket to participate in a reverse auction.",
    "image": "https://reverseauctionstorage.s3.us-east-2.amazonaws.com/tickets/m0vPvJJYzoyBHaFUddAO--1--ky4v8.jpg",
    "background_color": getRandomColor(),
    "attributes": [
        {
            "trait_type": "TYPE",
            "value": "NORMAL"
        }
    ]
  }

  var cid = await uploadMetadata(ticket);

  console.log(cid);

  NFTTicketContract.connect(signer).setTokenURI(ticketId,cid);

}

async function handleBuyModifierEvent(owner, modifierId, type, value){
  var ticket = {
    "name": "MODIFIER#"+modifierId.toString(),
    "description": "A NFT Modifier to use in reverse auction for change your number.",
    "image": "https://reverseauctionstorage.s3.us-east-2.amazonaws.com/modifiers/"+type.toString()+"_"+pad(value,2)+".png",
    "background_color": getRandomColor(),
    "attributes": [
      {
        "trait_type": "TYPE",
        "value": types[type]
      },
      {
        "trait_type": "VALUE",
        "value": value.toNumber()
      }
    ]
  }

  var cid = await uploadMetadata(ticket);

  console.log(cid);

  let tx = await NFTModifierContract.connect(signer).setTokenURI(modifierId,cid);
  await tx.wait();

}

// Start listening for the event when the server starts
(async () => {
  try {
    // Start listening for the event
    ReverseAuctionContract.on("Commit", async (bidder, auctionId, ticketId) => {
      // Process the commitData or trigger the function directly
      handleCommitEvent(bidder, auctionId, ticketId);
    });

    console.log('Listening for Commit events...');

    ReverseAuctionContract.on("BuyModifier", async (owner, modifierId, type, value) => {
      // Process the commitData or trigger the function directly
      handleBuyModifierEvent(owner, modifierId, type, value);
    });

    console.log('Listening for BuyModifier events...');
    
  } catch (error) {
    console.error('Error:', error);
  }
})();

app.post('/buyModifier', (req, res) => {
  let address = req.body.address;
  let type = generateRandomNumber(optionsType);
  let value = generateRandomNumber(optionsValue);

  res.set('Access-Control-Allow-Origin', '*');

  try{
    console.log(address, type, value)
    ReverseAuctionContract.connect(signer).buyModifier(address, type, value).then((tx) => {
      tx.wait().then(() => {return res.sendStatus(200)});
    });
    
  }
  catch (error){
    console.log(error)
  }

})

app.post('/participateRandom', (req, res) => {
  let address = req.body.address;
  let auction = req.body.auction;
  let password = req.body.password;
  let value = getRandomInt(1, 100);

  res.set('Access-Control-Allow-Origin', '*');

  try{
    console.log(address, auction, password, value)
    ReverseAuctionContract.createCommitment(value,password).then((commit) => {
      console.log(commit);
      ReverseAuctionContract.connect(signer).participateRandomAuction(commit, auction, address).then((tx) => {
        tx.wait().then(() => {return res.json({"number": value})});
      }).catch((error) => {
        console.log(error);
      });
      
    })
  }
  catch (error){
    console.log(error)
  }

})
 
// Require the Routes API 
// Create a Server and run it on the port 3002
const server = app.listen(3002, function () {
    let host = server.address().address
    let port = server.address().port
    // Starting the Server at the port 3002
})