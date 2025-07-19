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
    const socketId = req.query.socketId;
    const user = connectedUsers.get(socketId);

    if (user) { res.json({ user }); }
    else { res.status(404).json({ error: "User not found!" }); }
});
//----------Handle Connections----------

//Board Variables
const boardPieces = {
    X: "x",
    O: "o",
    CLEAR: ""
}

let gameBoard = [
    [boardPieces.clear, boardPieces.clear, boardPieces.clear, boardPieces.clear],
    [boardPieces.clear, boardPieces.clear, boardPieces.clear, boardPieces.clear],
    [boardPieces.clear, boardPieces.clear, boardPieces.clear, boardPieces.clear],
    [boardPieces.clear, boardPieces.clear, boardPieces.clear, boardPieces.clear]
]

//Get endpoint for client to poll the game board
app.get('/api/gameboard', (req, res) => {
    res.json({gameBoard});
});

//----------Game State----------
const gameState = {
    LOBBY: "lobby",
    PLAYING: "playing",
    GAMEOVER: "gameover",
}

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
app.post('/diceroll', (req, res) => {
    const socketID = req.query.socketID;
    const diceRoll = req.body.value;
    const user = connectedUsers.get(socketID);

    if (!user) { res.status(404).json({ error: "User not found!" }); }

    user.userRoll = diceRoll;
    connectedUsers.set(socketID, user);

    res.json({message: `User ${user.userID} rolled: ${diceRoll}`});
});
//----------Dice Rolling----------

httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port: ${port}`);
});