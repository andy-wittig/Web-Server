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
        connectedUsers.set(socket.id, {userID: id, isUserTurn: false, userRoll: -1, pieceType: ""});
    });

    socket.on("disconnect", () => {
        const user = connectedUsers.get(socket.id);
        connectedUsers.delete(socket.id);
        console.log(`User ${user.userID} disconnected and removed`);
    });
});

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

//----------Handle Gameboard----------
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

let winningPieces = [];

function checkBoardWinner(type)
{
    for (let i = 0; i < gameBoard.length; i ++) //Rows
    {
        if (gameBoard[i][0] == type && gameBoard[i][1] == type &&
            gameBoard[i][2] == type && gameBoard[i][3] == type )
        {
            for (let k = 0; k < 4; k++)
            {
                winningPieces[k] = i * (gameBoard.length) + k;
            }
            return true;
        }
    }

    for (let i = 0; i < gameBoard.length; i ++) //Columns
    {
        if (gameBoard[0][i] == type && gameBoard[1][i] == type &&
            gameBoard[2][i] == type && gameBoard[3][i] == type )
        {
            for (let k = 0; k < 4; k++)
            {
                winningPieces[k] = (gameBoard.length * k) + i;
            }
            return true;
        }
    }

    if (gameBoard[0][0] == type && gameBoard[1][1] == type &&
        gameBoard[2][2] == type && gameBoard[3][3] == type) //Diagonal Down
    {
        for (let k = 0; k < 4; k++)
        {
            winningPieces[k] = (gameBoard.length * k) + k;
        }
        return true;
    }

    if (gameBoard[0][3] == type && gameBoard[1][2] == type &&
        gameBoard[2][1] == type && gameBoard[3][0] == type) //Diagonal Up
    {
        for (let k = 0; k < 4; k++)
        {
            winningPieces[k] = (gameBoard.length - 1) * (k + 1);
        }
        return true;
    }

    return false;
}

function clearGame() //Reset server to inital state
{
    gameBoard = [
        [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR],
        [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR],
        [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR],
        [boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR, boardPieces.CLEAR]
    ];

    winningPieces = [];

    for (const user of connectedUsers.values()) //Reset user data except for id
    {
        user.isUserTurn = false;
        user.userRoll = -1;
        user.pieceType = "";
    }

    currentGameState = gameState.LOBBY;
    
    io.emit("boardCleared"); 
}

app.get('/api/gameboard', (req, res) => {
    res.json({ gameBoard });
});

app.get('/api/winning-pieces', (req, res) => {
    res.json({ winningPieces });
});

app.post('/api/set-gameboard', (req, res) => {
    const newGameboard = req.body.value;
    gameBoard = newGameboard;

    if (checkBoardWinner(boardPieces.X))
    {
        currentGameState = gameState.GAMEOVER;
    }
    else if (checkBoardWinner(boardPieces.O))
    {
        currentGameState = gameState.GAMEOVER;
    }

    res.status(200).json({ message: "Board was set successfully." });
});

app.post('/api/clear-board', (req, res) => {
    clearGame();
    res.status(200).json({ message: "Board was cleared successfully." });
});
//----------Handle Gameboard----------

//----------Handle Users----------
function switchTurns()
{
    for (const [id, user] of connectedUsers)
    {
        user.isUserTurn = !user.isUserTurn;
    }
}

app.get('/api/user-turn', (req, res) => {
    const socketID = req.query.socketID;
    const user = connectedUsers.get(socketID);
    
    if (user) { res.json({ isUserTurn: user.isUserTurn }); }
    else { res.status(404).json({ error: "User not found!" }); }
});

app.get('/api/user-piece-type', (req, res) => {
    const socketID = req.query.socketID;
    const user = connectedUsers.get(socketID);
    
    if (user) { res.json({ pieceType: user.pieceType }); }
    else { res.status(404).json({ error: "User not found!" }); }
});

app.post('/api/switch-turns', (req, res) => {
    switchTurns();
    res.status(200).json({ message: "Users turns switched successfully." });
});
//----------Handle Users----------

//----------Game State----------
const gameState = {
    LOBBY: "lobby",
    PLAYING: "playing",
    GAMEOVER: "gameover",
};

let currentGameState = gameState.LOBBY

app.get('/api/gamestate', (req, res) => {
    res.json({currentGameState});
});

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

    if (!user) { return res.status(404).json({ error: "User not found!" }); }

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
        updatedUser.pieceType = boardPieces.O;
        connectedUsers.set(closestKey, updatedUser);
        //console.log(updatedUser);

        for (const [id, user] of connectedUsers) //assign all other users to X
        {
            if (id !== closestKey)
            {
                user.isUserTurn = false;
                user.pieceType = boardPieces.X;
                connectedUsers.set(id, user);
            }
        }

        await delay(1); //let users read their dice rolls before changing state
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