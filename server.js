const express = require('express');
const cors = require("cors");
const { createServer } = require("node:http");
const { Server } = require("socket.io");

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

const connectedUsers = new Map();

io.on("connection", (socket) => {
    if (connectedUsers.size >= 2)
    {
        console.log("Sorry, your connection has been denied, there are too many users");
        socket.emit("connectionDenied", "Maximum number of users reached.");
        socket.disconnect(true);
        return;
    }

    console.log(`Socket connected: ${socket.id}`);

    socket.on("identify", (id) => {
        if (connectedUsers.size > 0)
        {
            setBtnState(false);
        }
        connectedUsers.set(socket.id, {userId: id, isBtnDisabled: true});
    });

    socket.on("disconnect", () => {
        const user = connectedUsers.get(socket.id);
        connectedUsers.delete(socket.id);
        console.log(`User ${user.userId} disconnected and removed`);
        if (connectedUsers.size <= 1) { setBtnState(true); }
    });
});

//Get Endpoint
app.get('/api/users', (req, res) => {
    const users = Array.from(connectedUsers.values()).map(user => user.userId);
    res.json({ usersOnline: users });
});

app.get('/api/data', (req, res) => {
    if (connectedUsers.size <= 2 && connectedUsers.size > 0)
    {
        const socketId = req.query.socketId;
        const user = connectedUsers.get(socketId);
        res.json({ isDisabled: user.isBtnDisabled });
    }
});

function switchBtnState()
{
    for (const [socketId, user] of connectedUsers)
    {
        const updatedUserInfo = { ...user, isBtnDisabled: !user.isBtnDisabled };
        connectedUsers.set(socketId, updatedUserInfo);
    }
}

function setBtnState(state)
{
    for (const [socketId, user] of connectedUsers)
    {
        const updatedUserInfo = { ...user, isBtnDisabled: state };
        connectedUsers.set(socketId, updatedUserInfo);
    }
}

//Post Endpoint
app.post("/api/switchBtnState", (req, res) => {
    switchBtnState()
    res.json({message: "Switched button states!"});
}); 

httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port: ${port}`);
});