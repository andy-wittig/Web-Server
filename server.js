//Express and CORS includes
const express = require('express');
const cors = require("cors");
const { createServer } = require("node:http");
const { Server } = require("socket.io");

//----------Server Setup----------
const port = process.env.PORT || 3000;
const app = express();

app.use(express.static('public'));
app.use(express.json());

const httpServer = createServer(app);

const corsOptions ={
    origin: "*"
}

app.use(cors(corsOptions));

const io = new Server(httpServer, {
    cors: corsOptions
});
//----------Server Setup----------

//----------Handle Connections----------
const connectedUsers = new Map();

io.on("connection", (socket) => {
    if (connectedUsers.size >= 2)
    {
        console.log("Sorry, your connection has been denied, there are too many users connected.");
        socket.emit("connectionDenied", "Maximum number of users has been reached.");
        socket.disconnect(true);
        return;
    }

    console.log(`Socket connected: ${socket.id}`);

    socket.on("identify", (id) => {
        connectedUsers.set(socket.id, {userID: id, isUserTurn: false, userRoll: -1});
    });

    socket.on("disconnect", () => {
        const user = connectedUsers.get(socket.id);
        connectedUsers.delete(socket.id);
        console.log(`User ${user.userID} disconnected and removed`);
    });
});

//Get endpoint for seeing currently connected users
app.get('/api/users', (req, res) => {
    const users = Array.from(connectedUsers.values()).map(user => user.userID);
    res.json({ usersOnline: users });
});

app.get('/api/data', (req, res) => {
    const socketID = req.query.socketID;
    const user = connectedUsers.get(socketID);

    if (user) { res.json({ user }); }
    else { res.status(404).json({ error: "User not found!" }); }
});
//----------Handle Connections----------

//Board Variables
const boardPieces = {
    X: "x",
    O: "o",
    CLEAR: "-"
};

let gameBoard = [
    [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR],
    [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR],
    [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR],
    [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR]
];

function clearGame() //Reset server to inital state
{
    gameBoard = [
        [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR],
        [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR],
        [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR],
        [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR]
    ];

    for (const user of connectedUsers.values()) //Reset user data except for id
    {
        user.isUserTurn = false;
        user.userRoll = -1;
    }

    currentGameState = gameState.LOBBY;
    
    io.emit("boardCleared"); 
}

//Get endpoint for client to poll the game board
app.get('/api/gameboard', (req, res) => {
    res.json({gameBoard});
});

app.post('/api/clear-board', (req, res) => {
    clearGame();
    res.status(200).json({ message: "Board was cleared successfully." });
});

app.get('/api/user-turn', (req, res) => {
    const socketID = req.query.socketID;
    const user = connectedUsers.get(socketID);
    
    if (user) { res.json({ isUserTurn: user.isUserTurn }); }
    else { res.status(404).json({ error: "User not found!" }); }
});

//----------Game State----------
const gameState = {
    LOBBY: "lobby",
    PLAYING: "playing",
    GAMEOVER: "gameover",
};

let currentGameState = gameState.LOBBY

//Get endpoint for client to poll the game state
app.get('/api/gamestate', (req, res) => {
    res.json({currentGameState});
});

//Post endpoint for client to set the game state
app.post("/submit", (req, res) => {
    const incomingState = req.body.value;
    currentGameState = incomingState
    res.json({message: `The game state was set to: ${incomingState}`});
}); 
//----------Game State----------

//----------Dice Rolling----------
app.post('/diceroll', async (req, res) => {
    const socketID = req.query.socketID;
    const diceRoll = req.body.value;
    const user = connectedUsers.get(socketID);

    if (!user) { res.status(404).json({ error: "User not found!" }); }

    user.userRoll = diceRoll;
    connectedUsers.set(socketID, user);

    res.json({message: `User ${user.userID} rolled: ${diceRoll}`});

    let diceRollsComplete = true
    for (const [id, user] of connectedUsers)
    {
        if (user.userRoll < 1) 
        { 
            diceRollsComplete = false;
            break;
        }
    }

    if (diceRollsComplete)
    {
        let serverRoll = getRandIntFromRange(1, 6);
        let closestDiff = Infinity;
        let closestKey = null;

        for (const [id, user] of connectedUsers)
        {
            const diff = Math.abs(user.userRoll - serverRoll);
            if (diff < closestDiff)
            {
                closestDiff = diff;
                closestKey = id;
            }
        }

        const updatedUser = connectedUsers.get(closestKey);
        updatedUser.isUserTurn = true;
        connectedUsers.set(closestKey, updatedUser);
        //console.log(updatedUser);

        await delay(2); //let users read their dice rolls before changing state
        currentGameState = gameState.PLAYING;
    }
});
//----------Dice Rolling----------

function getRandIntFromRange(min, max) //Inclusive
{
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function delay(time)
{
    let seconds = time * 1000;
    return new Promise(resolve => setTimeout(resolve, seconds));
}

httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port: ${port}`);
});